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
})("SchemaFactory", ["../utils/utils", "../parser/parser"], function (utils, parser) {

    const DEFAULT_ROOT_KEY = "target";

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
            let err = new Error("invalid " + key + " type: " + valuetype + ". value must be typed " + type);
            throw makeError(schema, key, valuetype, err);
        }
    };

    var Schema = function (schemadescriptor) {
        this.default = schemadescriptor.default;
        this.optional = schemadescriptor.optional;
        this.eq = schemadescriptor.eq;
        this.in = schemadescriptor.in;
        this.test = schemadescriptor.test;
        this.onerror = schemadescriptor.onerror;
    };
    Schema.prototype.rget = function (attr) {
        if (!attr || attr.length === 0) {
            return this;
        }
    };


    /**
     * Converts a Schematized Object to a StringObject.
     * 
     * @param {SchematizedObject} so
     * @param {boolean} [strict=true] In strict mode the schema will be tested to 
     * determine if all the objects it schematize can be converted to StringObjects.
     * If it fails, this method won't attempt to stringify the SchematizedObject and will 
     * directly throw an error. If strict mode is disabled, the SchematizedObject will 
     * be trimmed from all necessary properties to represent it as a StringObject.
     * @returns {SO}
     * 
     * @throws {Error} cannot be converted to SO
     */
    Schema.prototype.toSO = function (so, strict) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("so")) {
            throw new Error("objects enforced by this schema cannot be converted to StringObjects");
        }
        return parser.stringifyToSO(so);
    };
    /**
     * Converts a Schematized Object to a JSON object.
     * 
     * @param {SchematizedObject} so
     * @param {boolean} [strict=true] In strict mode the schema will be tested to 
     * determine if all the objects it schematize can be converted to JSON objects.
     * If it fails, this method won't attempt to stringify the SchematizedObject and will 
     * directly throw an error. If strict mode is disabled, the SchematizedObject will 
     * be trimmed from all necessary properties to represent it as a JSON object.
     * @returns {JSON object}
     * 
     * @throws {Error} cannot be converted to JSON
     */
    Schema.prototype.toJSON = function (so, strict) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("so")) {
            throw new Error("objects enforced by this schema cannot be converted to JSON objects");
        }
        return parser.stringifyToJSON(so);
    };

    Schema.prototype.enforce = function (value, key) {
        if (value === undefined) {
            if (this.optional) {
                return undefined;
            } else {
                value = this.makeDefault();
                if (value === undefined) {
                    key = key || DEFAULT_ROOT_KEY;
                    let err = new Error("invalid " + key + " value: " + "property required");
                    throw makeError(this, key, value, err);
                }
            }
        }
        _enforceType(this, this.type, utils.typeof(value), key);
        return value;
    };

    Schema.prototype.reduce = function (value) {
        if (value === undefined) {
            return undefined; // already reduced
        }
        return utils.equals(value, this.default) ? undefined : value;
    };

    Schema.prototype.expend = function (value) {
        if (value === undefined) {
            value = utils.clone(this.default);
        }
        return value;
    };

    Schema.prototype.makeDefault = function () {
        return utils.clone(this.default);
    };


    var PrimitiveSchema = function (schemadescriptor) {
        Schema.call(this, schemadescriptor);
    };
    PrimitiveSchema.prototype = Object.create(Schema.prototype);
    PrimitiveSchema.prototype.hasRepresentation = function (rep) {
        return ["string", "qs", "so", "json"].includes(rep);
    };
    PrimitiveSchema.prototype.fromSO = function (soso, strict, noenforce) {
        if (soso !== undefined) { // don't parse if undefined (optional?)
            soso = parser.parse(this.type, soso);
        }
        return noenforce ? soso : this.enforce(soso, false); // if head of recursive pile, enforce the schema
    };
    PrimitiveSchema.prototype.fromJSON = function (jsonso, strict, noenforce) {
        if (typeof jsonso === "string") { // don't parse if undefined (optional?) + json so numbers/boolean must not be reparsed
            jsonso = parser.parse(this.type, jsonso);
        }
        return noenforce ? jsonso : this.enforce(jsonso, false);
    };



    var StringSchema = function (schemadescriptor) {
        PrimitiveSchema.call(this, schemadescriptor);
        this.min = schemadescriptor.min;
        this.max = schemadescriptor.max;
        this.regex = schemadescriptor.regex;
    };
    StringSchema.prototype = Object.create(PrimitiveSchema.prototype);
    StringSchema.prototype.type = "string";
    StringSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.length, key);
        _enforceMax(this, this.max, value.length, key);
        _enforceRegex(this, this.regex, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var NumberSchema = function (schemadescriptor) {
        PrimitiveSchema.call(this, schemadescriptor);
        this.min = schemadescriptor.min;
        this.max = schemadescriptor.max;
        this.nan = schemadescriptor.nan;
    };
    NumberSchema.prototype = Object.create(PrimitiveSchema.prototype);
    NumberSchema.prototype.type = "number";
    NumberSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value, key);
        _enforceMax(this, this.max, value, key);
        !this.nan && _enforceNan(this, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var BooleanSchema = function (schemadescriptor) {
        PrimitiveSchema.call(this, schemadescriptor);
    };
    BooleanSchema.prototype = Object.create(PrimitiveSchema.prototype);
    BooleanSchema.prototype.type = "boolean";
    BooleanSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var DateSchema = function (schemadescriptor) {
        PrimitiveSchema.call(this, schemadescriptor);
        this.min = schemadescriptor.min && schemadescriptor.min.getTime();
        this.max = schemadescriptor.max && schemadescriptor.max.getTime();
    };
    DateSchema.prototype = Object.create(PrimitiveSchema.prototype);
    DateSchema.prototype.type = "date";
    DateSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.getTime(), key);
        _enforceMax(this, this.max, value.getTime(), key);
        _enforceTest(this, this.test, value, key);
        return value;
    };


    var RegexSchema = function (schemadescriptor) {
        PrimitiveSchema.call(this, schemadescriptor);
    };
    RegexSchema.prototype = Object.create(PrimitiveSchema.prototype);
    RegexSchema.prototype.type = "regex";
    RegexSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };



    var FunctionSchema = function (schemadescriptor) {
        Schema.call(this, schemadescriptor);
    };
    FunctionSchema.prototype = Object.create(Schema.prototype);
    FunctionSchema.prototype.type = "function";
    FunctionSchema.prototype.hasRepresentation = function (rep) {
        return false;
    };
    FunctionSchema.prototype.fromSO = function (soso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict) {
            throw new Error("cannot parse a function from a StringObject");
        }
        return noenforce ? undefined : this.enforce(undefined, false);
    };
    FunctionSchema.prototype.fromJSON = function (jsonso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict) {
            throw new Error("cannot parse a function from a JSON object");
        }
        return noenforce ? undefined : this.enforce(undefined, false);
    };

    FunctionSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };



    var ArraySchema = function (schemadescriptor) {
        Schema.call(this, schemadescriptor);
        this.min = schemadescriptor.min;
        this.max = schemadescriptor.max;
        this.schema = schemadescriptor.schema && SchemaFactory.make(schemadescriptor.schema, true);
    };
    ArraySchema.prototype = Object.create(Schema.prototype);
    ArraySchema.prototype.type = "array";
    ArraySchema.prototype.hasRepresentation = function (rep) {
        if (!this.schema) {
            return false;
        } else if (rep === "qs") {
            return !["array", "object"].includes(this.schema.type) && this.schema.hasRepresentation("qs");
        } else if (rep === "so") {
            return this.schema.hasRepresentation("so");
        } else if (rep === "json") {
            return this.schema.hasRepresentation("json");
        } else {
            return false;
        }
    };

    ArraySchema.prototype.fromSO = function (soso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("so")) {
            throw new Error("objects enforced by this schema cannot be converted from StringObjects");
        }
        if (typeof soso === "string"){
            soso = [soso];
        }
        if (Array.isArray(soso)) { // could be undefined if optional
            let schema = this.schema;
            soso = soso.map(function (soso, index) {
                return schema.fromSO(soso, strict, true);
            });
        }
        return noenforce ? soso : this.enforce(soso, false); // if head of recursive pile, enforce the schema
    };
    ArraySchema.prototype.fromJSON = function (jsonso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("so")) {
            throw new Error("objects enforced by this schema cannot be converted from JSON objects");
        }
        if (Array.isArray(jsonso)) {
            let schema = this.schema;
            jsonso = jsonso.map(function (jsonso, index) {
                return schema.fromJSON(jsonso, strict, true);
            });
        }
        return noenforce ? jsonso : this.enforce(jsonso, false);
    };

    ArraySchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }
        if (this.schema) {
            for (let i = 0; i < value.length; i++) {
                value[i] = this.schema.enforce(value[i], key + "[" + i + "]");
            }
        }
        _enforceEq(this, this.eq, value, key);
        _enforceIn(this, this.in, value, key);
        _enforceMin(this, this.min, value.length, key);
        _enforceMax(this, this.max, value.length, key);
        _enforceTest(this, this.test, value, key);
        return value;
    };

    ArraySchema.prototype.expend = function (value) {
        if (value === undefined) {
            value = [];
        }
        if (this.schema) {
            for (let i = 0; i < value.length; i++) {
                value[i] = this.schema.expend(value[i]);
            }
        }
        return value;
    };
    ArraySchema.prototype.reduce = function (value) {
        if (typeof value === undefined) {
            return undefined; // already reduced
        } else if (value.length === 0) {
            return undefined;
        } else {
            return value;
        }
    };
    ArraySchema.prototype.makeDefault = function () {
        return [];
    };



    var ObjectSchema = function (schemadescriptor) {
        Schema.call(this, schemadescriptor);
        this.schemas = null;
        if (schemadescriptor.schema) {
            this.schemas = {};
            for (let prop in schemadescriptor.schema) {
                this.schemas[prop] = SchemaFactory.make(schemadescriptor.schema[prop], true);
            }
        }
    };
    ObjectSchema.prototype = Object.create(Schema.prototype);
    ObjectSchema.prototype.type = "object";
    ObjectSchema.prototype.hasRepresentation = function (rep) {
        if (!this.schemas) {
            return false;
        }if (["qs", "so", "json"].includes(rep)) {
            for (let prop in this.schemas) {
                if (!this.schemas[prop].hasRepresentation(rep)) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    };

    /**
     * Recursive schema getter.
     * 
     * @param {string} attr
     * @returns {Schema}
     */
    ObjectSchema.prototype.rget = function (attr) {
        if (typeof attr === "string") {
            attr = attr.split(".");
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
     * Parses a Schematized Object from a SO.
     * 
     * @param {SO} soso
     * @param {boolean} [strict=true] In strict mode, objects enforcing a schema whose schematized objects
     *   can not be represented as a StringObject will automatically trigger an error.
     * @param {boolean} [noenforce=false]
     * @returns {SchematizedObject}
     * 
     * @throws {Error} entities applying this schema cannot be parsed from QSO
     * @throws {Error} schematized object doesn't match schema
     */
    ObjectSchema.prototype.fromSO = function (soso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("so")) {
            throw new Error("objects enforced by this schema cannot be converted from StringObjects");
        }
        let ret;
        if (soso !== undefined) {
            ret = {};
            for (let prop in soso) {
                if (this.schemas.hasOwnProperty(prop)) {
                    ret[prop] = this.schemas[prop].fromSO(soso[prop], true);
                } else {
                    ret[prop] = soso[prop]; // doesn't matter, will throw an error when enforced
                }
            }
        }
        return noenforce ? ret : this.enforce(ret, false); // if head of recursive pile, enforce the schema
    };
    /**
     * Parses a Schematized Object from a JSON object.
     * 
     * @param {JSON} jsonso
     * @param {boolean} [strict=true] In strict mode, objects enforcing a schema whose schematized objects
     *   can not be represented in json will automatically trigger an error.
     * @param {boolean} [noenforce=false]
     * @returns {SchematizedObject}
     * 
     * @throws {Error} entities applying this schema cannot be parsed from JSON
     * @throws {Error} schematized object doesn't match schema
     */
    ObjectSchema.prototype.fromJSON = function (jsonso, strict, noenforce) {
        strict = strict === false ? false : true;
        if (strict && !this.hasRepresentation("json")) {
            throw new Error("objects enforced by this schema cannot be converted from JSON objects");
        }
        let ret;
        if (jsonso !== undefined) {
            ret = {};
            for (let prop in jsonso) {
                if (this.schemas.hasOwnProperty(prop)) {
                    ret[prop] = this.schemas[prop].fromJSON(jsonso[prop], true);
                } else {
                    ret[prop] = jsonso[prop]; // doesn't matter, will throw an error when enforced
                }
            }
        }
        return noenforce ? ret : this.enforce(ret, false);
    };

    /**
     * Enforce the Schema on a Schematized Object.
     * Returns a clone of the original Schematized Object.
     * 
     * @param {SchematizedObject} value
     * @param {string} [key] Used by errors to be more descriptive of the schema transgression.
     * @returns {SchematizedObject}
     * 
     * @throws {Error} Schematized Object doesn't match the Schema
     */
    ObjectSchema.prototype.enforce = function (value, key) {
        key = key || DEFAULT_ROOT_KEY;
        value = Schema.prototype.enforce.call(this, value, key);
        if (value === undefined) {
            return value;
        }

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
                value[prop] = this.schemas[prop].enforce(value[prop], key + "." + prop);
            }
        }
        _enforceTest(this, this.test, value, key);

        return value;
    };

    /**
     * Expends the missing optional values of a Schematized Object.
     * 
     * @param {SchematizedObject} value
     * @returns {SchematizedObject}
     */
    ObjectSchema.prototype.expend = function (value) {
        if (value === undefined) {
            value = {};
        }
        if (this.schemas) {
            for (let prop in this.schemas) {
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
     * @returns {SchematizedObject|undefined} The same SchematizedObject, or undefined
     */
    ObjectSchema.prototype.reduce = function (value) {
        if (value === undefined) {
            return undefined; // already reduced
        }
        if (this.schemas) {
            for (let prop in value) {
                let reducedprop = this.schemas[prop].reduce(value[prop]);
                if (reducedprop === undefined) {
                    delete value[prop];
                } else {
                    value[prop] = reducedprop;
                }
            }
        }
        if (utils.equals(value, {})) { // default object can only be empty object
            return undefined;
        } else {
            return value;
        }
    };

    ObjectSchema.prototype.makeDefault = function () {
        let def = {};
        if (this.schemas) {
            for (let prop in this.schemas) {
                def[prop] = this.schemas[prop].makeDefault();
            }
        }
        return def;
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
    var SchemaFactory = {};
    /**
     * Schemas describing the supported syntax of schemas by type.
     * They are used to enforce the validity of new schemas to construct
     */
    SchemaFactory.schemas = {};
    /**
     * Schemas constructors by type
     */
    SchemaFactory.constructors = {
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
        if (!SchemaFactory.schemas.hasOwnProperty(schemadesc.type)) {
            throw new Error("invalid schema: invalid type: " + schemadesc.type);
        }
        SchemaFactory.schemas[schemadesc.type].enforce(schemadesc);
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
    SchemaFactory.make = function (descriptor, _noenforce) {
        if (!_noenforce) {
            try {
                _testSchema(descriptor);
            } catch (err) {
                err.message = "invalid schema descriptor:\n" + JSON.stringify(descriptor, null, 2) + "\n" + err.message;
                throw err;
            }
        }
        return new SchemaFactory.constructors[descriptor.type](descriptor);
    };


    /*
     * The schemas desribing the authorized syntax of schemas by type
     */
    ["string", "number", "object", "date", "boolean", "function", "regex", "array"].forEach(function (type) {
        SchemaFactory.schemas[type] = {
            type: "object",
            schema: {}
        };
        let _schema = SchemaFactory.schemas[type].schema;
        _schema.type = {type: "string", eq: type};
        _schema.default = {type: type, optional: true};
        _schema.optional = {type: "boolean", optional: true};
        _schema.eq = {type: type, optional: true};
        _schema.in = {type: "array", optional: true, schema: {type: type}};
        _schema.test = {type: "function", optional: true};
        _schema.onerror = {type: "function", optional: true};
    });
    ["string", "number", "array", "date"].forEach(function (type) {
        let _schema = SchemaFactory.schemas[type].schema;
        _schema.min = {type: "number", optional: true};
        _schema.max = {type: "number", optional: true};
    });
    SchemaFactory.schemas.object.schema.schema = {type: "object", test: _testPartialSchema, optional: true};
    SchemaFactory.schemas.array.schema.schema = {type: "object", test: _testSchema, optional: true};
    delete SchemaFactory.schemas.object.schema.default;
    delete SchemaFactory.schemas.array.schema.default;
    SchemaFactory.schemas.string.schema.regex = {type: "regex", optional: true};
    SchemaFactory.schemas.number.schema.nan = {type: "boolean", optional: true};

    for (let type in SchemaFactory.schemas) {
        SchemaFactory.schemas[type] = new SchemaFactory.constructors[SchemaFactory.schemas[type].type](SchemaFactory.schemas[type]);
    }

    return SchemaFactory;
});


