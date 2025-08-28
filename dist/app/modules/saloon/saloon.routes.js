"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const saloon_controller_1 = require("./saloon.controller");
const saloon_validation_1 = require("./saloon.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// router.post(
// '/',
// auth(),
// validateRequest(saloonValidation.createSchema),
// saloonController.createSaloon,
// );
router.patch('/manage-bookings', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(saloon_validation_1.saloonValidation.createSchema), saloon_controller_1.saloonController.manageBookings);
router.get('/dashboard', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloon_controller_1.saloonController.getBarberDashboard);
router.get('/bookings', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloon_controller_1.saloonController.getCustomerBookings);
router.get('/transactions', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloon_controller_1.saloonController.getTransactions);
router.get('/barbers', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloon_controller_1.saloonController.getAllBarbers);
router.patch('/terminate-barber', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloon_controller_1.saloonController.terminateBarber);
router.delete('/:id', (0, auth_1.default)(), saloon_controller_1.saloonController.deleteSaloon);
exports.saloonRoutes = router;
