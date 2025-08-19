"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberHolidayRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const barberHoliday_controller_1 = require("./barberHoliday.controller");
const barberHoliday_validation_1 = require("./barberHoliday.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(barberHoliday_validation_1.barberHolidayValidation.createBarberDayOffSchema), barberHoliday_controller_1.barberHolidayController.createBarberHoliday);
router.get('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), barberHoliday_controller_1.barberHolidayController.getBarberHolidayList);
router.get('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), barberHoliday_controller_1.barberHolidayController.getBarberHolidayById);
router.patch('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(barberHoliday_validation_1.barberHolidayValidation.updateBarberDayOffSchema), barberHoliday_controller_1.barberHolidayController.updateBarberHoliday);
router.delete('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), barberHoliday_controller_1.barberHolidayController.deleteBarberHoliday);
exports.barberHolidayRoutes = router;
