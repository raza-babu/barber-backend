"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberScheduleRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const barberSchedule_controller_1 = require("./barberSchedule.controller");
const barberSchedule_validation_1 = require("./barberSchedule.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(), (0, validateRequest_1.default)(barberSchedule_validation_1.barberScheduleValidation.createSchema), barberSchedule_controller_1.barberScheduleController.createBarberSchedule);
router.get('/', (0, auth_1.default)(), barberSchedule_controller_1.barberScheduleController.getBarberScheduleList);
router.get('/:id', (0, auth_1.default)(), barberSchedule_controller_1.barberScheduleController.getBarberScheduleById);
router.put('/:id', (0, auth_1.default)(), (0, validateRequest_1.default)(barberSchedule_validation_1.barberScheduleValidation.updateSchema), barberSchedule_controller_1.barberScheduleController.updateBarberSchedule);
router.delete('/:id', (0, auth_1.default)(), barberSchedule_controller_1.barberScheduleController.deleteBarberSchedule);
exports.barberScheduleRoutes = router;
