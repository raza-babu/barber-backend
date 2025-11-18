"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRoutes = void 0;
const express_1 = __importDefault(require("express"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const queueManagement_controller_1 = require("./queueManagement.controller");
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const booking_validation_1 = require("../booking/booking.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER, client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(booking_validation_1.bookingValidation.createBookingSchema), queueManagement_controller_1.bookingController.createBooking);
router.get('/customers', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER), queueManagement_controller_1.bookingController.getBookingList);
router.get('/list', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), queueManagement_controller_1.bookingController.getBookingListForSalonOwner);
router.get('/barbers', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.CUSTOMER), (0, validateRequest_1.default)(booking_validation_1.bookingValidation.availableBarbersSchema), queueManagement_controller_1.bookingController.getAvailableBarbers);
router.get('/walking-in/barbers/:saloonId/:type', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.CUSTOMER), 
// validateRequest(bookingValidation.walkingInBarbersSchema),
queueManagement_controller_1.bookingController.getAvailableBarbersForWalkingIn);
router.get('/barbers/:saloonId/:barberId', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.CUSTOMER), 
// validateRequest(bookingValidation.walkingInBarbersSchema),
queueManagement_controller_1.bookingController.getAvailableABarberForWalkingIn);
router.get('/customers/:id', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER), queueManagement_controller_1.bookingController.getBookingById);
router.get('/salons/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), queueManagement_controller_1.bookingController.getBookingByIdForSalonOwner);
router.put('/reschedule', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER, client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(booking_validation_1.bookingValidation.updateBookingSchema), queueManagement_controller_1.bookingController.updateBooking);
router.put('/schedule-status', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(booking_validation_1.bookingValidation.updateBookingStatusSchema), queueManagement_controller_1.bookingController.updateBookingStatus);
router.patch('/cancel/:id', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER), queueManagement_controller_1.bookingController.cancelBooking);
router.delete('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), queueManagement_controller_1.bookingController.deleteBooking);
router.get('/loyalty-schemes/:id', (0, auth_1.default)(client_1.UserRoleEnum.CUSTOMER), queueManagement_controller_1.bookingController.getLoyaltySchemesForACustomer);
exports.bookingRoutes = router;
