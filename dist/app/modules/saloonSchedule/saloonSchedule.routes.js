"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonScheduleRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const saloonSchedule_controller_1 = require("./saloonSchedule.controller");
const saloonSchedule_validation_1 = require("./saloonSchedule.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(saloonSchedule_validation_1.saloonScheduleValidation.createSaloonScheduleSchema), saloonSchedule_controller_1.saloonScheduleController.createSaloonSchedule);
router.get('/', (0, auth_1.default)(), saloonSchedule_controller_1.saloonScheduleController.getSaloonScheduleList);
router.get('/:id', (0, auth_1.default)(), saloonSchedule_controller_1.saloonScheduleController.getSaloonScheduleById);
router.patch('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(saloonSchedule_validation_1.saloonScheduleValidation.updateSaloonScheduleSchema), saloonSchedule_controller_1.saloonScheduleController.updateSaloonSchedule);
router.delete('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), saloonSchedule_controller_1.saloonScheduleController.deleteSaloonSchedule);
exports.saloonScheduleRoutes = router;
