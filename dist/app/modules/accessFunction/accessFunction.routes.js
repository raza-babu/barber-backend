"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessFunctionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const accessFunction_controller_1 = require("./accessFunction.controller");
const accessFunction_validation_1 = require("./accessFunction.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(), (0, validateRequest_1.default)(accessFunction_validation_1.accessFunctionValidation.createSchema), accessFunction_controller_1.accessFunctionController.createAccessFunction);
router.get('/', (0, auth_1.default)(), accessFunction_controller_1.accessFunctionController.getAccessFunctionList);
router.get('/:id', (0, auth_1.default)(), accessFunction_controller_1.accessFunctionController.getAccessFunctionById);
router.put('/:id', (0, auth_1.default)(), (0, validateRequest_1.default)(accessFunction_validation_1.accessFunctionValidation.updateSchema), accessFunction_controller_1.accessFunctionController.updateAccessFunction);
router.delete('/:id', (0, auth_1.default)(), accessFunction_controller_1.accessFunctionController.deleteAccessFunction);
exports.accessFunctionRoutes = router;
