(function (name, deps, definition) {
    if (!definition) {
        definition = deps;
        deps = [];
    }
    if (!Array.isArray(deps)) {
        deps = [deps];
    }
    if (typeof define === "function" && typeof define.amd === "object") {
        define(deps, definition);
    } else if (typeof module !== "undefined") {
        module.exports = definition.apply(this, deps.map(function (dep) {
            return require(dep);
        }));
    } else {
        var that = this;
        this[name] = definition.apply(this, deps.map(function (dep) {
            return that[dep.split("/").pop()];
        }));
    }
})("Schema", ["./utils", "./parser"], function (utils, parser) {

    /**
     * Tests if the SchematizedObjects schematized by the Schema schemadesc 
     * can be converted to PSO (PathStringObject @see PS)
     * 
     * @param {SchemaDescriptor} schemadesc 
     * @returns {boolean} 
     */
    let _testSchematizedObjectPSO = function (schemadesc) {
        if (schemadesc.type === "function") {
            return false;
        } else if (schemadesc.type === "array") {
            return false;
        } else if (schemadesc.type === "object") {
            if (!schemadesc.schema) {
                return false;
            } else {
                for (let prop in schemadesc.schema) {
                    if (!_testSchematizedObjectPSO(schemadesc.schema[prop])) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            return true;
        }
    };

    /**
     * Converts the schema (not a schematized object) to a QSO (QueryStringObject @see QS)
     * 
     * @param {SchemaDescriptor} schemadesc 
     * @returns {QSO} 
     */
    let _makeSchemaQSO = function (schemadesc) {
        let qso = null;
        try {
            qso = parser.stringifyToQSO(schemadesc);
        } catch (err) {

        }
        return qso;
    };

    /**
     * Tests if the SchematizedObjects schematized by the Schema schemadesc 
     * can be converted to QSO (QueryStringObject @see QS)
     * 
     * @param {SchemaDescriptor} schemadesc 
     * @param {boolean} flag Internal use only.
     * @returns {boolean} 
     */
    let _testSchematizedObjectQSO = function (schemadesc, flag) {
        if (schemadesc.type === "function") {
            return false;
        } else if (schemadesc.type === "array") {
            if (flag) {
                return false;
            } else if (!schemadesc.schema) {
                return false;
            } else {
                return _testSchematizedObjectQSO(schemadesc.schema, true);
            }
        } else if (schemadesc.type === "object") {
            if (flag) {
                return false;
            } else if (!schemadesc.schema) {
                return false;
            } else {
                for (let prop in schemadesc.schema) {
                    if (!_testSchematizedObjectQSO(schemadesc.schema[prop])) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            return true;
        }
    };

    /**
     * Converts the schema (not a schematized object) to a JSON object
     * 
     * @param {SchemaDescriptor} schemadesc 
     * @returns {JSON object} 
     */
    let _makeSchemaJSON = function (schemadesc) {
        let json = null;
        try {
            json = parser.stringifyToJSON(schemadesc);
        } catch (err) {

        }
        return json;
    };

    /**
     * Tests if the SchematizedObjects schematized by the Schema schemadesc 
     * can be converted to JSON
     * 
     * @param {SchemaDescriptor} schemadesc 
     * @returns {boolean} 
     */
    let _testSchematizedObjectJSON = function (schemadesc) {
        if (schemadesc.type === "function") {
            return false;
        } else if (schemadesc.type === "array") {
            return !!schemadesc.schema && _testSchematizedObjectJSON(schemadesc.schema);
        } else if (schemadesc.type === "object") {
            if (!schemadesc.schema) {
                return false;
            }
            for (let prop in schemadesc.schema) {
                if (!_testSchematizedObjectJSON(schemadesc.schema[prop])) {
                    return false;
                }
            }
            return true;
        } else {
            return true;
        }
    };

    let makeError = function (schema, key, value, err) {
        if (schema.onerror) {
            let _err = this.onerror(key, value, schema, err);
            _err.originalError = err;
            err = _err;
        }
        return err;
    };

    let _enforceIn = function (schema, values, value, key) {
        if (!Array.isArray(values)) {
            return;
        }
        for (let i = 0; i < values.length; i++) {
            let value2 = values[i];
            if (utils.equals(value, value2)) {
                return;
            }
        }

        let err = new Error("invalid " + key + " value: " + value + ". value must be in [" + values.join(", ") + "]");
        throw makeError(schema, key, value, err);
    };
    let _enforceEq = function (schema, value2, value, key) {
        if (typeof value2 === "undefined") {
            return;
        }
        if (!utils.equals(value, value2)) {
            let err = new Error("invalid " + key + " value: " + value + ". value must be " + value2);
            throw makeError(schema, key, value, err);
        }
    };
    let _enforceMin = function (schema, min, value, key) {
        if (typeof min === "number" && value < min) {
            let err = new Error("invalid " + key + " value: " + value + ". value must be greater than " + min);
            throw makeError(schema, key, value, err);
        }
    };
    let _enforceMax = function (schema, max, value, key) {
        if (typeof max === "number" && value > max) {
            let err = new Error("invalid " + key + " value: " + value + ". value must be lesser than " + max);
            throw makeError(schema, key, value, err);
        }
    };
    let _enforceNan = function (schema, value, key) {
        if (Number.isNaN(value)) {
            let err = new Error("invalid " + key + " value: " + value + ". value must be a number");
            throw makeError(schema, key, value, err);
        }
    };
    let _enforceTest = function (schema, test, value, key) {
        if (typeof test === "function") {
            let res = test(value, key, schema);
            if (!res) {
                let err = new Error("invalid " + key + " value: " + value);
                throw makeError(schema, key, value, err);
            }
            if (typeof res === "string") {
                let err = new Error("invalid " + key + " value: " + value + ". " + res);
                throw makeError(schema, key, value, err);
            }
        }
    };
    let _enforceRegex = function (schema, regex, value, key) {
        if (regex && !regex.test(value, key)) {
            let err = new Error("invalid " + key + " value: " + value + ". value must match " + regex.toString());
            throw makeError(schema, key, value, err);
        }
    };
    let _enforceType = function (schema, type, valuetype, key) {
        if (valuetype !== type) {
            let err = new Error("invalid " + key + " value: " + valuetype + ". value must be typed " + type);
            throw makeError(schema, key, valuetype, err);
        }
    };

    var Schema = function () {};
    Schema.prototype.enforce = function (value, expend, key) {
        if (typeof expend === "string") {
            key = expend;
            expend = false;
        }
        key = key || "target"; // used by error messages
        if (expend && typeof value === "undefined") {
            value = utils.clone(this.default);
        }
        if (typeof value === "undefined") {
            if (!this.optional) {
                let err = new Error("invalid " + key + " value: " + "property required");
                throw makeError(this, key, value, err);
            } else {
                return undefined;
            }
        }
        return value;
    };


    var PrimitiveSchema = function () {
        this.qso = null;
        this.json = null;
    };
    PrimitiveSchema.prototype = new Schema();
    PrimitiveSchema.prototype.primitive = true;
    PrimitiveSchema.prototype.rget = function (attr) {
        if (!attr || attr.length === 0) {
            return this;
        }
    };
    PrimitiveSchema.prototype.toPSO = function (so) {
        return parser.stringifyToPSO(so);
    };
    PrimitiveSchema.prototype.toQSO = function (so) {
        if (so) {
            return parser.stringifyToQSO(so);
        } else {
            if (!this.qso) {
                throw new Error("this schema cannot be converted to QSO");
            }
            return utils.clone(this.qso);
        }
    };
    PrimitiveSchema.prototype.toJSON = function (so) {
        if (so) {
            return parser.stringifyToJSON(so);
        } else {
            if (!this.json) {
                throw new Error("this schema cannot be converted to JSON");
            }
            return utils.clone(this.json);
        }
    };
    PrimitiveSchema.prototype.fromPSO = function (psoso, noenforce) {
        if (typeof psoso === "string") {
            psoso = parser.parse(this.type, psoso);
        } else {
            throw new Error("invalid target PSO");
        }
        return noenforce ? psoso : this.enforce(psoso); // if head of recursive pile, enforce the schema
    };
    PrimitiveSchema.prototype.fromQSO = function (qsoso, noenforce) {
        if (typeof qsoso === "string") {
            qsoso = parser.parse(this.type, qsoso);
        } else {
            throw new Error("invalid target QSO");
        }
        return noenforce ? qsoso : this.enforce(qsoso); // if head of recursive pile, enforce the schema
    };
    PrimitiveSchema.prototype.fromJSON = function (jsonso, noenforce) {
        jsonso = parser.parse(this.type, jsonso);
        return noenforce ? jsonso : this.enforce(jsonso);
    };

    PrimitiveSchema.prototype.expend = function (value) {
        if (typeof value === "undefined") {
            value = utils.clone(this.default);
        }
        return value;
    };
    PrimitiveSchema.prototype.reduce = function (value) {
        if (typeof value === "undefined") {
            return undefined; // already reduced
        }
        return utils.equals(value, this.default) ? undefined : value;
    };

    var StringSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.min = schema.min;
        this.max = schema.max;
        this.regex = schema.regex;
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    StringSchema.prototype = new PrimitiveSchema();
    StringSchema.prototype.type = "string";
    StringSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        _enforceType(this, "string", typeof value, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.length, key);
        _enforceMax(this, this.max, value.length, key);
        _enforceRegex(this, this.regex, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var NumberSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.min = schema.min;
        this.max = schema.max;
        this.nan = schema.nan;
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    NumberSchema.prototype = new PrimitiveSchema();
    NumberSchema.prototype.type = "number";
    NumberSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        _enforceType(this, "number", typeof value, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        !this.nan && _enforceNan(this, value, key);
        _enforceMin(this, this.min, value, key);
        _enforceMax(this, this.max, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var BooleanSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    BooleanSchema.prototype = new PrimitiveSchema();
    BooleanSchema.prototype.type = "boolean";
    BooleanSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        _enforceType(this, "boolean", typeof value, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var DateSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.min = schema.min && schema.min.getTime();
        this.max = schema.max && schema.max.getTime();
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    DateSchema.prototype = new PrimitiveSchema();
    DateSchema.prototype.type = "date";
    DateSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        let type = (value instanceof Date ? "date" : "nodate");
        _enforceType(this, "date", type, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.getTime(), key);
        _enforceMax(this, this.max, value.getTime(), key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var RegexSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    RegexSchema.prototype = new PrimitiveSchema();
    RegexSchema.prototype.type = "regex";
    RegexSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        _enforceType(this, "regex", value instanceof RegExp ? "regex" : "noregex", key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };



    var FunctionSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.test = schema.test;
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified
    };
    FunctionSchema.prototype = new Schema();
    FunctionSchema.prototype.type = "function";
    FunctionSchema.prototype.rget = function (attr) {
        if (!attr || attr.length === 0) {
            return this;
        }
    };
    FunctionSchema.prototype.toPSO = function (so) {
        throw new Error("cannot convert a function to PSO");
    };
    FunctionSchema.prototype.toQSO = function (so) {
        if (so) {
            throw new Error("cannot convert a function to QSO");
        } else {
            if (!this.qso) {
                throw new Error("this schema cannot be converted to QSO");
            }
            return utils.clone(this.qso);
        }
    };
    FunctionSchema.prototype.toJSON = function (so) {
        if (so) {
            throw new Error("cannot convert a function to JSON");
        } else {
            if (!this.json) {
                throw new Error("this schema cannot be converted to JSON");
            }
            return utils.clone(this.json);
        }
    };
    FunctionSchema.prototype.fromPSO = function () {
        throw new Error("cannot parse a function from PSO");
    };
    FunctionSchema.prototype.fromQSO = function () {
        throw new Error("cannot parse a function from QSO");
    };
    FunctionSchema.prototype.fromJSON = function () {
        throw new Error("cannot parse a function from JSON");
    };

    FunctionSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }
        _enforceType(this, "function", typeof value, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };
    FunctionSchema.prototype.expend = function (value) {
        if (typeof value === "undefined") {
            value = utils.clone(this.default);
        }
        return value || this.default;
    };
    FunctionSchema.prototype.reduce = function (value) {
        if (typeof value === "undefined") {
            return undefined; // already reduced
        }
        return utils.equals(value, this.default) ? undefined : value;
    };



    var ArraySchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.test = schema.test;
        this.min = schema.min;
        this.max = schema.max;
        this.schema = schema.schema && factory.make(schema.schema, true);
        this.onerror = schema.onerror;

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified

        this._qsoable = _testSchematizedObjectQSO(schema); // are the schematized objects querystringifiable
        this._jsonable = _testSchematizedObjectJSON(schema); // are the schematized objects stringifiable
    };
    ArraySchema.prototype = new Schema();
    ArraySchema.prototype.type = "array";
    ArraySchema.prototype.rget = function (attr) {
        if (!attr || attr.length === 0) {
            return this;
        }
    };
    ArraySchema.prototype.toPSO = function (so) {
        throw new Error("cannot convert an array to PSO");
    };
    ArraySchema.prototype.toQSO = function (so) {
        if (so) {
            if (!this._qsoable) {
                throw new Error("this schematized object cannot be converted to QSO");
            } else {
                return parser.stringifyToQSO(so);
            }
        } else {
            if (!this.qso) {
                throw new Error("this schema cannot be converted to QSO");
            }
            return utils.clone(this.qso);
        }
    };
    ArraySchema.prototype.toJSON = function (so) {
        if (so) {
            if (!this._jsonable) {
                throw new Error("this schematized object cannot be converted to JSON");
            } else {
                return parser.stringifyToJSON(so);
            }
        } else {
            if (!this.json) {
                throw new Error("this schema cannot be converted to JSON");
            }
            return utils.clone(this.json);
        }
    };
    ArraySchema.prototype.fromPSO = function () {
        throw new Error("cannot parse an array from PSO");
    };
    ArraySchema.prototype.fromQSO = function (qsoso, noenforce) {
        if (!this._qsoable) {
            throw new Error("objects applying this schema cannot be parsed from QSO");
        }
        if (Array.isArray(qsoso)) {
            let schema = this.schema;
            qsoso = qsoso.map(function (qsoso, index) {
                return schema.fromQSO(qsoso, true);
            });
        }
        return noenforce ? qsoso : this.enforce(qsoso); // if head of recursive pile, enforce the schema
    };
    ArraySchema.prototype.fromJSON = function (jsonso, noenforce) {
        if (!this._jsonable) {
            throw new Error("objects applying this schema cannot be parsed from JSON");
        }
        if (Array.isArray(jsonso)) {
            let schema = this.schema;
            jsonso = jsonso.map(function (jsonso, index) {
                return schema.fromJSON(jsonso, true);
            });
        }
        return noenforce ? jsonso : this.enforce(jsonso);
    };

    ArraySchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }

        _enforceType(this, "array", Array.isArray(value) ? "array" : (typeof value), key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.length, key);
        _enforceMax(this, this.max, value.length, key);
        if (this.schema) {
            for (let i = 0; i < value.length; i++) {
                value[i] = this.schema.enforce(value[i], expend, key + "[" + i + "]");
            }
        }
        _enforceTest(this, this.test, value, key);
        return value;
    };
    ArraySchema.prototype.expend = function (value) {
        if (typeof value === "undefined") {
            value = utils.clone(this.default);
        }
        if (this.schema) {
            for (let i = 0; i < value.length; i++) {
                value[i] = this.schema.expend(value[i]);
            }
        }
        return value;
    };
    ArraySchema.prototype.reduce = function (value) {
        if (typeof value === "undefined") {
            return undefined; // already reduced
        }
        if (this.schema) {
            for (let i = 0; i < value.length; i++) {
                value[i] = this.schema.reduce(value[i]);
                if (typeof value[i] === "undefined") {
                    value.splice(i, 1);
                    i--;
                }
            }
        }
        if (value.length === 0 && this.default) { // default array can only be empty array
            return undefined;
        } else {
            return value;
        }
    };



    var ObjectSchema = function (schema) {
        this.default = schema.default;
        this.optional = schema.optional;
        this.eq = schema.eq;
        this.in = schema.in;
        this.test = schema.test;
        this.onerror = schema.onerror;
        this.schemas = null;
        if (schema.schema) {
            this.schemas = {};
            for (let prop in schema.schema) {
                this.schemas[prop] = factory.make(schema.schema[prop], true);
            }
        }

        this.qso = _makeSchemaQSO(schema);  // if the schema can be QueryStringObject-ified
        this.json = _makeSchemaJSON(schema); // if the schema can be JSON-ified

        this._psoable = _testSchematizedObjectPSO(schema);
        this._qsoable = _testSchematizedObjectQSO(schema); // are the schematized objects querystringifiable
        this._jsonable = _testSchematizedObjectJSON(schema); // are the schematized objects stringifiable
    };
    ObjectSchema.prototype = new Schema();
    ObjectSchema.prototype.type = "object";
    /**
     * Recursive schema getter.
     * 
     * @param {string} attr
     * @returns {Schema}
     */
    ObjectSchema.prototype.rget = function (attr) {
        if (typeof attr === "string") {
            attr = attr.splice(".");
        }
        if (attr.length === 0) {
            return this;
        } else if (this.schemas) {
            let curr = attr.shift();
            if (this.schemas[curr]) {
                return this.schemas[curr].rget(attr);
            }
        }
    };

    /**
     * Converts a Schematized Object to a PSO.
     * 
     * @param {SchematizedObject} so
     * @returns {PSO}
     * 
     * @throws {Error} cannot be converted to PSO
     */
    ObjectSchema.prototype.toPSO = function (so) {
        if (!this._psoable) {
            throw new Error("this schematized object cannot be converted to PSO");
        } else {
            return parser.stringifyToPSO(so);
        }
    };

    /**
     * Converts the Schema itself or a Schematized Object to a QSO.
     * If no Schematized Object is given, the Schema itself is converted to a QSO.
     * 
     * @param {SchematizedObject} [so]
     * @returns {QSO}
     * 
     * @throws {Error} cannot be converted to QSO
     */
    ObjectSchema.prototype.toQSO = function (so) {
        if (so) {
            if (!this._qsoable) {
                throw new Error("this schematized object cannot be converted to QSO");
            } else {
                return parser.stringifyToQSO(so);
            }
        } else {
            if (!this.qso) {
                throw new Error("this schema cannot be converted to QSO");
            }
            return utils.clone(this.qso);
        }
    };
    /**
     * Converts the Schema itself or a Schematized Object to a valid JSON object.
     * If no Schematized Object is given, the Schema itself is converted.
     * 
     * @param {SchematizedObject} [so]
     * @returns {JSON}
     * 
     * @throws {Error} cannot be converted to JSON
     */
    ObjectSchema.prototype.toJSON = function (so) {
        if (so) {
            if (!this._jsonable) {
                throw new Error("this schematized object cannot be converted to JSON");
            } else {
                return parser.stringifyToJSON(so);
            }
        } else {
            if (!this.json) {
                throw new Error("this schema cannot be converted to JSON");
            }
            return utils.clone(this.json);
        }
    };


    /**
     * Parses a Schematized Object from a PSO.
     * 
     * @param {PSO} psoso
     * @param {boolean} [noenforce=false]
     * @returns {SchematizedObject}
     * 
     * @throws {Error} entities applying this schema cannot be parsed from PSO
     * @throws {Error} schematized object doesn't match schema
     */
    ObjectSchema.prototype.fromPSO = function (psoso, noenforce) {
        if (!this._psoable) {
            throw new Error("objects applying this schema cannot be parsed from PSO");
        }
        let ret = {};
        for (let prop in psoso) {
            if (this.schemas.hasOwnProperty(prop)) {
                ret[prop] = this.schemas[prop].fromPSO(psoso[prop], true);
            }
        }
        return noenforce ? ret : this.enforce(ret); // if head of recursive pile, enforce the schema
    };

    /**
     * Parses a Schematized Object from a QSO.
     * 
     * @param {QSO} qsoso
     * @param {boolean} [noenforce=false]
     * @returns {SchematizedObject}
     * 
     * @throws {Error} entities applying this schema cannot be parsed from QSO
     * @throws {Error} schematized object doesn't match schema
     */
    ObjectSchema.prototype.fromQSO = function (qsoso, noenforce) {
        if (!this._qsoable) {
            throw new Error("objects applying this schema cannot be parsed from QSO");
        }
        let ret = {};
        for (let prop in qsoso) {
            if (this.schemas.hasOwnProperty(prop)) {
                ret[prop] = this.schemas[prop].fromQSO(qsoso[prop], true);
            }
        }
        return noenforce ? ret : this.enforce(ret); // if head of recursive pile, enforce the schema
    };
    /**
     * Parses a Schematized Object from a JSON object.
     * 
     * @param {JSON} jsonso
     * @param {boolean} [noenforce=false]
     * @returns {SchematizedObject}
     * 
     * @throws {Error} entities applying this schema cannot be parsed from JSON
     * @throws {Error} schematized object doesn't match schema
     */
    ObjectSchema.prototype.fromJSON = function (jsonso, noenforce) {
        if (!this._jsonable) {
            throw new Error("objects applying this schema cannot be parsed from JSON");
        }
        if (typeof jsonso === "object") {
            let ret = {};
            for (let prop in jsonso) {
                if (this.schemas.hasOwnProperty(prop)) {
                    ret[prop] = this.schemas[prop].fromJSON(jsonso[prop], true);
                }
            }
        }
        return noenforce ? ret : this.enforce(ret);
    };

    /**
     * Enforce the Schema on a Schematized Object.
     * Returns a clone of the original Schematized Object.
     * 
     * @param {SchematizedObject} value
     * @param {boolean} [expend=true] Add missing optional values to the target.
     * @param {string} [key] Used by errors to be more descriptive of the schema transgression.
     * @returns {SchematizedObject}
     * 
     * @throws {Error} Schematized Object doesn't match the Schema
     */
    ObjectSchema.prototype.enforce = function (value, expend, key) {
        value = Schema.prototype.enforce.call(this, value, expend, key);
        if (typeof value === "undefined") {
            return;
        }

        _enforceType(this, "object", typeof value, key);
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        if (this.schemas) {
            for (let prop in value) {
                if (!this.schemas.hasOwnProperty(prop)) {
                    let err = new Error("invalid " + key + " value: invalid property: " + prop);
                    throw makeError(this, key, value, err);
                }
            }
            for (let prop in this.schemas) {
                value[prop] = this.schemas[prop].enforce(value[prop], expend, key + "." + prop);
            }
        }
        _enforceTest(this, this.test, value, key);

        return value;
    };

    /**
     * Expends the missing optional values of a Schematized Object. The new properties 
     * are cloned from the Schema default values.
     * 
     * @param {SchematizedObject} value
     * @returns {SchematizedObject}
     */
    ObjectSchema.prototype.expend = function (value) {
        if (typeof value === "undefined") {
            value = utils.clone(this.default);
        }
        if (this.schemas) {
            for (let prop in this.schemas) {
                value = value || {};
                value[prop] = this.schemas[prop].expend(value[prop]);
            }
        }
        return value;
    };

    /**
     * Removes the optional values of a Schematized Object if they match the default
     * values of the Schema.
     * 
     * @param {SchematizedObject} value
     * @returns {SchematizedObject}
     */
    ObjectSchema.prototype.reduce = function (value) {
        if (typeof value === "undefined") {
            return undefined; // already reduced
        }
        if (this.schemas) {
            let ret;
            for (let prop in value) {
                if (!(ret = this.schemas[prop].reduce(value[prop]))) {
                    delete value[prop];
                } else {
                    value[prop] = ret;
                }
            }
        }
        if (this.default && utils.equals(value, {})) { // default object can only be empty object
            return undefined;
        } else {
            return value;
        }
    };




    /**
     * A schema library.
     * Schemas describe javascript entities (objects, primitives, ...) syntaxes.
     * 
     * @example 
     * For instance a schema can be used to force the objects it schematizes to be 
     * of type number and be greater than 0. Such a schema will look like
     * var schema = {
     *   type: "number",
     *   min: 0
     * };
     * 
     * Entities which respect a schema are called Schematized Objects (they can be primitives such as numbers). 
     * They can easily be stringified or parsed to/from JSON objects or QSO.
     * 
     * A schema descriptor is an object with one required property - `type`, all other 
     * properties are optional. 
     * The types currently supported are string, number, array, object, date, boolean, function and regex.
     * The tests a schema can perform depends on the type of the entity it schematizes.
     * Some tests can be performed on any type of entity:
     *  * optional: [boolean=false]
     *  * eq: {entity matching the schema}
     *  * in: array<{entity matching the schema}>   
     *  * test: function<{entity matching the schema other tests}>: boolean  # may throw a descriptive error
     *  * default: {entity matching the schema}                              # the default value is always cloned (@see utils.clone()), 
     *        arrays and objects default values can only be empty ([] or {})
     * 
     * The number schema descriptors can also possess the tests
     *  * nan: [boolean=false] # if false, a NaN value will throw an error
     *  * min: number
     *  * max: number
     * 
     * The string schema descriptors can also have the tests:
     *  * min: number # min length of the string
     *  * max: number # max length of the string
     *  * regex: RegExp
     * 
     * The date schema descriptors can also have the tests:
     *  * min: Date
     *  * max: Date
     *  * regex: RegExp
     * 
     * The array schema descriptors can also have the tests:
     *  * min: number
     *  * max: number
     *  * schema: SchemaDescriptor # Schematizes the elements of the array
     * 
     * The object schema descriptors can also have the tests:
     *  * schema: PartialSchemaDescriptor # Schematizes the properties of the object, 
     *     a PartialSchemaDescriptor is a object whose keys are the authorized keys 
     *     of the Schematized Object and values are SchemaDescriptors which schematize 
     *     the values of the Schematized Object.
     * 
     * There is one more optional property acceptable for schemadescriptors, that is
     * `onerror` if specified and a schematized object fails this schema, instead of the
     * default error, this method will be called and its result will be throw as error.
     * Note that the default error will still be accessible from the result `originalError`
     * property.
     * 
     * onerror: function<key: string, value, schema: Schema, originalError: Error>: Error
     * 
     * This method allows for specialized error messages and is particularily useful when 
     * the resulting error must be transformed to be displayed to a client (translation, customization, ...)
     * 
     * 
     * @exports schema
     */
    var factory = {};
    /**
     * Schemas describing the supported syntax of schemas by type.
     * They are used to enforce the validity of new schemas to construct
     */
    factory.schemas = {};
    /**
     * Schemas constructors by type
     */
    factory.constructors = {
        "string": StringSchema,
        "number": NumberSchema,
        "boolean": BooleanSchema,
        "date": DateSchema,
        "regex": RegexSchema,
        "function": FunctionSchema,
        "array": ArraySchema,
        "object": ObjectSchema
    };

    var _testSchema = function (schemadesc) {
        if (typeof schemadesc !== "object") {
            throw new Error("invalid schema: must be an object");
        }
        if (!factory.schemas.hasOwnProperty(schemadesc.type)) {
            throw new Error("invalid schema: invalid type: " + schemadesc.type);
        }
        factory.schemas[schemadesc.type].enforce(schemadesc);
        return true;
    };
    var _testPartialSchema = function (partialdesc, key) {
        if (typeof partialdesc !== "object") {
            throw new Error("partial " + key + " must be an object");
        }
        for (let prop in partialdesc) {
            let schema = partialdesc[prop];
            _testSchema(schema);
        }
        return true;
    };


    /**
     * Instanciates a new Schema from a schema descriptor. The validity of the
     * schema descriptor is enforced (except if the _noenforce flag is set).
     * 
     * @param {SchemaDescriptor} descriptor
     * @param {boolean} [_noenforce=false]
     * @returns {Schema}
     */
    factory.make = function (descriptor, _noenforce) {
        if (!_noenforce) {
            try {
                _testSchema(descriptor);
            } catch (err) {
                err.message = "invalid schema descriptor:\n" + JSON.stringify(descriptor, null, 2) + "\n" + err.message;
                throw err;
            }
        }
        return new factory.constructors[descriptor.type](descriptor);
    };


    /*
     * The schemas desribing the authorized syntax of schemas by type
     */
    ["string", "number", "object", "date", "boolean", "function", "regex", "array"].forEach(function (type) {
        factory.schemas[type] = {
            type: "object",
            schema: {}
        };
        let _schema = factory.schemas[type].schema;
        _schema.type = {type: "string", eq: type};
        _schema.default = {type: type, optional: true};
        _schema.optional = {type: "boolean", optional: true};
        _schema.eq = {type: type, optional: true};
        _schema.in = {type: "array", optional: true, schema: {type: type}};
        _schema.test = {type: "function", optional: true};
        _schema.onerror = {type: "function", optional: true};
    });
    ["string", "number", "array", "date"].forEach(function (type) {
        let _schema = factory.schemas[type].schema;
        _schema.min = {type: "number", optional: true};
        _schema.max = {type: "number", optional: true};
    });
    factory.schemas.object.schema.schema = {type: "object", test: _testPartialSchema, optional: true};
    factory.schemas.array.schema.schema = {type: "object", test: _testSchema, optional: true};
    factory.schemas.object.schema.default.eq = {};
    factory.schemas.array.schema.default.eq = [];
    factory.schemas.string.schema.regex = {type: "regex", optional: true};
    factory.schemas.number.schema.nan = {type: "boolean", optional: true};

    for (let type in factory.schemas) {
        factory.schemas[type] = new factory.constructors[factory.schemas[type].type](factory.schemas[type]);
    }

    return factory;
});


