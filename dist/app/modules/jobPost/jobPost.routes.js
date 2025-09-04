"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobPostRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const jobPost_controller_1 = require("./jobPost.controller");
const jobPost_validation_1 = require("./jobPost.validation");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
router.post('/', 
// multerUploadMultiple.fields([
//   { name: 'shop_logo', maxCount: 1 },
// ]),
// parseBody,
(0, auth_1.default)(), (0, validateRequest_1.default)(jobPost_validation_1.jobPostValidation.createJobPostSchema), jobPost_controller_1.jobPostController.createJobPost);
router.get('/', (0, auth_1.default)(client_1.UserRoleEnum.ADMIN, client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), jobPost_controller_1.jobPostController.getJobPostList);
router.get('/:id', (0, auth_1.default)(client_1.UserRoleEnum.ADMIN, client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.SALOON_OWNER, client_1.UserRoleEnum.BARBER), jobPost_controller_1.jobPostController.getJobPostById);
router.patch('/:id', 
// multerUploadMultiple.fields([
//   { name: 'shop_logo', maxCount: 1 },
// ]),
// parseBody,
(0, auth_1.default)(client_1.UserRoleEnum.SALOON_OWNER), (0, validateRequest_1.default)(jobPost_validation_1.jobPostValidation.updateJobPostSchema), jobPost_controller_1.jobPostController.updateJobPost);
router.patch('/:jobPostId/active', (0, auth_1.default)(client_1.UserRoleEnum.ADMIN, client_1.UserRoleEnum.SUPER_ADMIN, client_1.UserRoleEnum.SALOON_OWNER), jobPost_controller_1.jobPostController.toggleJobPostActive);
router.delete('/:id', (0, auth_1.default)(), jobPost_controller_1.jobPostController.deleteJobPost);
exports.jobPostRoutes = router;
