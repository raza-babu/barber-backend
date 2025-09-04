"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handleZodError = (err) => {
    let message = "";
    const errorDetails = {
        issues: err.issues.map((issue) => {
            message =
                message + issue.message == "Expected number, received string"
                    ? (issue === null || issue === void 0 ? void 0 : issue.path[issue.path.length - 1]) + " " + issue.message
                    : message + ". " + issue.message;
            return {
                path: issue === null || issue === void 0 ? void 0 : issue.path[issue.path.length - 1],
                message: issue.message,
            };
        }),
    };
    const statusCode = 400;
    return {
        statusCode,
        message,
        errorDetails,
    };
};
exports.default = handleZodError;
