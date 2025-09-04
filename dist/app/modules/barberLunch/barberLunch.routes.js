"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberLunchRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const barberLunch_controller_1 = require("./barberLunch.controller");
const barberLunch_validation_1 = require("./barberLunch.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(barberLunch_validation_1.barberLunchValidation.createBarberLunchSchema), barberLunch_controller_1.barberLunchController.createBarberLunch);
router.get('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), barberLunch_controller_1.barberLunchController.getBarberLunchList);
router.get('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), barberLunch_controller_1.barberLunchController.getBarberLunchById);
router.put('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(barberLunch_validation_1.barberLunchValidation.updateBarberLunchSchema), barberLunch_controller_1.barberLunchController.updateBarberLunch);
router.delete('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), barberLunch_controller_1.barberLunchController.deleteBarberLunch);
exports.barberLunchRoutes = router;
