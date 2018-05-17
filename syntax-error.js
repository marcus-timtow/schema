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
})("SchemaSyntaxError", ["../utils/utils", "../parser/parser"], function (utils, parser) {
    
    
    const MAX_STRINGIFIED_VALUE_LENGTH = 64;
    const DEFAULT_MESSAGE = "-";


    /**
     * A syntax error which may be encountered while validating a schematized js object.
     * 
     * @constructor
     * @extends Error
     * 
     * @argument {string} msg
     * @argument {object} details
     * @argument {string} [details.key] 
     * @argument {*} [details.value] 
     * @argument {Schema} [details.schema] 
     */
    let SyntaxError = function (msg, details) {
        //Error.call(this, msg);
        if (typeof msg === "object"){
            details = msg;
            msg = DEFAULT_MESSAGE;
        }
        details = details || {};
        
        this.key = details.key;
        this.value = parser.stringifyToJSON(details.value);
        let stringifiedvalue = JSON.stringify(this.value);
        if (stringifiedvalue > MAX_STRINGIFIED_VALUE_LENGTH){
            stringifiedvalue = stringifiedvalue.substr(0, MAX_STRINGIFIED_VALUE_LENGTH-3) + "...";
        }
        this.message = "syntax error - invalid " + this.key + ": " + stringifiedvalue + " - " + msg;
        this.schema = details.schema;
        
        if (this.schema && this.schema.onerror) {
            this.schema.onerror(this);
        }
    };
//SyntaxError.prototype = Object.create(Error.prototype);
    SyntaxError.prototype.toJSON = function () {
        let ret = {
            message: this.message,
            key: this.key,
            value: this.value
        };
        return ret;
    };
    SyntaxError.prototype.toString = function () {
        return this.message;
    };

    return SyntaxError;

});