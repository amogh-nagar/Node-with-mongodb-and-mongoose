const express = require("express");
const { check, body } = require("express-validator/check");
const router = express.Router();
const User = require("../models/user");
const authController = require("../controllers/auth");
router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email!")
      .normalizeEmail(),
    //   .custom((value, { req }) => {
    //     return User.findOne({ email: value }).then((user) => {
    //       if (!user) {
    //         return Promise.reject("Email does not exists");
    //       }
    //     });
    //   }),
    body(
      "password",
      "Password must be atleast of 5 characters and should contain alphabets only"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin
);

router.post("/logout", authController.postLogout);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email!")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userdoc) => {
          if (userdoc) {
            return Promise.reject(
              "Email already exists, please pick up a different one"
            );
          }
        });
      })
      .normalizeEmail(),
    body(
      "password",
      "Please enter a password with only numbers and texts and atleast 5 charcaters"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password have to match");
      }
      return true;
    }).trim(),
  ],
  authController.postSignup
);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getnewpassowrd);

router.post("/new-password", authController.postnewpassword);

module.exports = router;
