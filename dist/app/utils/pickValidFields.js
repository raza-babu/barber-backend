"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickValidFields = void 0;
const pickValidFields = (obj, keys) => {
    const result = {};
    keys.forEach((key) => {
        if (obj && Object.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    });
    return result;
};
exports.pickValidFields = pickValidFields;
