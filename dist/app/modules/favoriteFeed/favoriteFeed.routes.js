"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteFeedRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const favoriteFeed_controller_1 = require("./favoriteFeed.controller");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(), 
//   validateRequest(favoriteFeedValidation.createSchema),
favoriteFeed_controller_1.favoriteFeedController.createFavoriteFeed);
router.get('/', (0, auth_1.default)(), favoriteFeed_controller_1.favoriteFeedController.getFavoriteFeedList);
router.get('/:id', (0, auth_1.default)(), favoriteFeed_controller_1.favoriteFeedController.getFavoriteFeedById);
router.put('/:id', (0, auth_1.default)(), 
//   validateRequest(favoriteFeedValidation.updateSchema),
favoriteFeed_controller_1.favoriteFeedController.updateFavoriteFeed);
router.delete('/:id', (0, auth_1.default)(), favoriteFeed_controller_1.favoriteFeedController.deleteFavoriteFeed);
exports.favoriteFeedRoutes = router;
