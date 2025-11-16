"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonRegisteredBookingRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const nonRegisteredBooking_controller_1 = require("./nonRegisteredBooking.controller");
const nonRegisteredBooking_validation_1 = require("./nonRegisteredBooking.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(nonRegisteredBooking_validation_1.nonRegisteredBookingValidation.createSchema), nonRegisteredBooking_controller_1.nonRegisteredBookingController.createNonRegisteredBooking);
router.get('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), nonRegisteredBooking_controller_1.nonRegisteredBookingController.getNonRegisteredBookingList);
router.get('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), nonRegisteredBooking_controller_1.nonRegisteredBookingController.getNonRegisteredBookingById);
router.put('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(nonRegisteredBooking_validation_1.nonRegisteredBookingValidation.updateSchema), nonRegisteredBooking_controller_1.nonRegisteredBookingController.updateNonRegisteredBooking);
router.delete('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), nonRegisteredBooking_controller_1.nonRegisteredBookingController.deleteNonRegisteredBooking);
exports.nonRegisteredBookingRoutes = router;
