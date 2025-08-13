"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBody = void 0;
const parseBody = (req, res, next) => {
    if (req.body.bodyData) {
        try {
            req.body = JSON.parse(req.body.bodyData);
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON format in bodyData',
            });
        }
    }
    next();
};
exports.parseBody = parseBody;
