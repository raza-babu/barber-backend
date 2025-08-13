"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const admin_controller_1 = require("./admin.controller");
const admin_validation_1 = require("./admin.validation");
const client_1 = require("@prisma/client");
const checkPermissions_1 = require("../../middlewares/checkPermissions");
const access_1 = require("../../utils/access");
const router = express_1.default.Router();
router.get('/dashboard', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.ADMIN_MANAGEMENT), 
//   validateRequest(adminValidation.createSchema),
admin_controller_1.adminController.getAdminDashboard);
router.get('/saloons', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.SALOON_OWNER), admin_controller_1.adminController.getSaloonList);
router.patch('/block-saloon/:id', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.SALOON_OWNER), (0, validateRequest_1.default)(admin_validation_1.adminValidation.blockSchema), admin_controller_1.adminController.blockSaloonById);
router.get('/barbers', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.BARBER_MANAGEMENT), admin_controller_1.adminController.getBarbersList);
router.patch('/block-barber/:id', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.BARBER_MANAGEMENT), (0, validateRequest_1.default)(admin_validation_1.adminValidation.blockSchema), admin_controller_1.adminController.blockBarberById);
router.get('/customers', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.CUSTOMER), admin_controller_1.adminController.getCustomersList);
router.patch('/block-customer/:id', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.CUSTOMER), (0, validateRequest_1.default)(admin_validation_1.adminValidation.blockSchema), admin_controller_1.adminController.blockCustomerById);
router.patch('/verify-saloon-owner/:id', (0, auth_1.default)(client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.ADMIN), (0, checkPermissions_1.checkPermissions)(access_1.UserAccessFunctionName.ALL || access_1.UserAccessFunctionName.SALOON_OWNER), (0, validateRequest_1.default)(admin_validation_1.adminValidation.updateSchema), admin_controller_1.adminController.updateSaloonOwnerById);
exports.adminRoutes = router;
