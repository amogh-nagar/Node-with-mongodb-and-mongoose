const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const { validationResult } = require("express-validator/check");
const User = require("../models/user");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
    },
  })
);

const sgmail = require("@sendgrid/mail");
sgmail.setApiKey(
  "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"
);

exports.getLogin = (req, res, next) => {
  //   const isLoggedIn = req.get("Cookie").split("=")[1].trim();
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  console.log(req.session.isLoggedIn);
  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: message,
    oldInput: {
      email: "",
      password: "",
    },

    validationErrors: [],
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    isLoggedIn: false,
    errorMessage: message,
    oldInput: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  //   res.setHeader("Set-Cookie", "loggedIn=true; ");
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errorMessage: erros.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
      },

      validationErrors: errors,
    });
  }
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "Login",
          errorMessage: "Invalid Email",
          oldInput: {
            email: email,
            password: password,
          },

          validationErrors: [{ param: "email" }],
        });
      }
      bcrypt
        .compare(password, user.password)
        .then((domatch) => {
          if (domatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              console.log(err);
              res.redirect("/");
            });
          }
          return res.status(422).render("auth/login", {
            path: "/login",
            pageTitle: "Login",
            errorMessage: "Invalid Password",
            oldInput: {
              email: email,
              password: password,
            },

            validationErrors: [{ param: "password" }],
          });
        })
        .catch((err) => {
          console.log(err);
          res.redirect("/login");
        });
    })
    .catch((err) => {
      const error = new Error("Creating a product failed");
      errors.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
  //session cookie will still exists but session on backend will be removed
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });
      return user.save();
    })
    .then(() => {
      // res.redirect("/")

      transporter
        .sendMail({
          to: email,
          from: "amoghnagar1111@gmail.com",
          subject: "Signup Succeeded",
          html: "<h1>You successfully Signed Up</h1>",
        })
        .then(() => {
          res.redirect("/");
          console.log("Email sent successfully");
        })
        .catch((err) => {
          console.log(err);
          console.log("Email didnt sent");
        });
    })
    // .then(() => {
    //   res.redirect("/");
    // })
    .catch((err) => {
      const error = new Error("Creating a product failed");
      errors.httpStatusCode = 500;
      return next(error);
    });
};

exports.getReset = (req, res, next) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: message,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      //  req.flash('error','')
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No Account with that email found");
          return res.redirect("/reset");
        }

        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then((result) => {
        transporter.sendMail({
          to: req.body.email,
          from: "amoghnagar1111@gmail.com",
          subject: "Passowrd Reset",
          html: `
      <p>You requested a password reset</p>
      <p>Click this <a href="http://localhost:3000/reset/${token}"> link</a>  to set a new password</p>
      `,
        });
        res.redirect("/");
      })
      .catch((err) => {
        const error = new Error("Creating a product failed");
        errors.httpStatusCode = 500;
        return next(error);
      });
  });
};

exports.getnewpassowrd = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      let message = req.flash("error");
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }

      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        errorMessage: message,
        passwordtoken: token,
        userId: user._id.toString(),
      });
    })
    .catch((err) => {
      const error = new Error("Creating a product failed");
      errors.httpStatusCode = 500;
      return next(error);
    });
};

exports.postnewpassword = (req, res, next) => {
  const newpassword = req.body.password;
  const userId = req.body.userId;
  const passwordtoken = req.body.passwordtoken;
  let resetuser;
  User.findOne({
    resetToken: passwordtoken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      resetuser = user;
      return bcrypt.hash(newpassword, 12);
    })
    .then((hashedPassword) => {
      resetuser.password = hashedPassword;
      resetuser.resetToken = null;
      resetuser.resetTokenExpiration = undefined;
      return resetuser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => {
      const error = new Error("Creating a product failed");
      errors.httpStatusCode = 500;
      return next(error);
    });
};
