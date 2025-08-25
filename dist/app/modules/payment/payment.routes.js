"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const payment_controller_1 = require("./payment.controller");
const payment_validation_1 = require("./payment.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.CUSTOMER), (0, validateRequest_1.default)(payment_validation_1.paymentValidation.createSchema), payment_controller_1.paymentController.createPayment);
router.get('/', (0, auth_1.default)(), payment_controller_1.paymentController.getPaymentList);
router.get('/:id', (0, auth_1.default)(), payment_controller_1.paymentController.getPaymentById);
router.put('/:id', (0, auth_1.default)(), (0, validateRequest_1.default)(payment_validation_1.paymentValidation.updateSchema), payment_controller_1.paymentController.updatePayment);
router.delete('/:id', (0, auth_1.default)(), payment_controller_1.paymentController.deletePayment);
exports.paymentRoutes = router;
