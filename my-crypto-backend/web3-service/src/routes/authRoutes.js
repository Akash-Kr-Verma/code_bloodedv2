const { Router } = require("express");
const { getMe, login, signup, verify } = require("../controllers/authController.js");
const { authMiddleware } = require("../middleware/authMiddleware.js");

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify", verify);
router.get("/me", authMiddleware, getMe);

module.exports = router;