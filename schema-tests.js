
let Schema = require("./schema");
let QS = require("./qs");

let idpageschemadesc = {
    type: "object",
    schema: {
        "bookId": {
            type: "string",
            regex: /^[\da-f]{24,24}/
        },
        "index": {
            type: "number",
            min: 0,
            max: 350
        },
        "pending": {
            type: "boolean",
            optional: true,
            default: false
        }
    }
};
console.log("making schema... ");
let idpageschema = Schema.make(idpageschemadesc);
console.log("done");

let ids = [
    {
        bookId: "01234567890123456789abcd",
        index: 0
    },
    "01234567890123456789abcd",
    {
        bookId: 0,
        index: 0
    },
    {
        bookId: "01234567890123456789abcd",
        index: -1
    }, {
        bookId: "01234567890123456789abcd",
        index: 0,
        invalidfield: "a"
    }, {
        bookId: "01234567890123456789abcd"
    }
];

console.log("enforcing schema on ids... ");
let validids = ids.filter(function (id) {
    try {
        idpageschema.enforce(id, true, "id");
    } catch (err) {
        console.log(err);
        return false;
    }
    return true;
});
console.log("done");

console.log("stringifying valid ids...");
validids.forEach(function (id) {
    console.log(QS.stringify(idpageschema.toQSO(id)));
    console.log(JSON.stringify(idpageschema.toJSON(id), null, 4));
});
console.log("done");






