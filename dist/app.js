"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const routes_1 = __importDefault(require("./app/routes"));
const logger_1 = require("./app/middlewares/logger");
const path_1 = __importDefault(require("path"));
const payment_controller_1 = require("./app/modules/payment/payment.controller");
const app = (0, express_1.default)();
app.use(logger_1.logger);
// app.use(loggerConsole);
// app.use(
//   cors({
//     origin: [
//       "http://localhost:3001",
//       "http://localhost:3000",
//       "http://10.10.20.60:3005",
//       "http://10.10.20.60:3006",
//       "http://10.10.20.60:3007",
//       "http://10.10.20.60:3008",
//     ],
//     credentials: true,
//   })
// );
// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   }),
// );
app.use((0, cors_1.default)({
    origin: "*", // Allow all origins for development
    credentials: true, // Allow credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use('/api/v1/stripe/payment-webhook', express_1.default.raw({ type: 'application/json' }), payment_controller_1.PaymentController.handleWebHook);
//parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send({
        Message: "The server is running. . .",
    });
});
// Serve static files from 'public' folder
app.use(express_1.default.static(path_1.default.join(process.cwd(), "public")));
app.use("/api/v1", routes_1.default);
app.use(globalErrorHandler_1.default);
app.use((req, res, next) => {
    res.status(http_status_1.default.NOT_FOUND).json({
        success: false,
        message: "API NOT FOUND!",
        error: {
            path: req.originalUrl,
            message: "Your requested path is not found!",
        },
    });
});
exports.default = app;
