"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lunchRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const lunch_controller_1 = require("./lunch.controller");
const lunch_validation_1 = require("./lunch.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(lunch_validation_1.lunchValidation.createLunchSchema), lunch_controller_1.lunchController.createLunch);
router.get('/', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), lunch_controller_1.lunchController.getLunchList);
router.get('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), lunch_controller_1.lunchController.getLunchById);
router.patch('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(lunch_validation_1.lunchValidation.updateLunchSchema), lunch_controller_1.lunchController.updateLunch);
router.delete('/:id', (0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), lunch_controller_1.lunchController.deleteLunch);
exports.lunchRoutes = router;
