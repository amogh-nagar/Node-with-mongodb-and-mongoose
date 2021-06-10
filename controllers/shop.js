const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const pdfdocument = require("pdfkit");
const stripe = require("stripe")(
  "sk_test_51J0S6WSA1T61xlcfEt25rFDQhudiiNECU9UhMJ6PQ8EkffluqVVC5VlA6zxaa5rjrFdcprsb59zJke9LApzLRdAu00qvoKzdJb"
);

const ITEMS_PER_PAGE = 2

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalitems;
  Product.find()
    .countDocuments()
    .then((numberofproducts) => {
      totalitems = numberofproducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })

    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalitems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalitems / ITEMS_PER_PAGE),
        // isLoggedIn:req.session.isLoggedIn
        // csrfToken:req.csrfToken()
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
        isLoggedIn: req.session.isLoggedIn,
      });
    })
    .catch((err) => console.log(err));
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalitems;
  Product.find()
    .countDocuments()
    .then((numberofproducts) => {
      totalitems = numberofproducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })

    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalitems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalitems / ITEMS_PER_PAGE),
        // isLoggedIn:req.session.isLoggedIn
        // csrfToken:req.csrfToken()
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      console.log('items are '+user.cart.items);
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
        isLoggedIn: req.session.isLoggedIn,
      });
    })
    .catch((err) => console.log(err));
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log(result);
      res.redirect("/cart");
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .deleteItemFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => console.log(err));
};

exports.getCheckout = (req, res, next) => {
  let products;

  let total = 0;

  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      console.log(user.cart.items);
      products = user.cart.items;
      products.forEach((p) => {
        total += p.quantity + p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: products.map((p) => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: "usd",
            quantity: p.quantity,
          };
        }),
        success_url:
          req.protocol + "://" + req.get("host") + "/checkout/success", //once the transaction was completed
        cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel", //once the transaction failed
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Your checkout",
        products: products,
        totalSum: total,
        sessionId: session.id,
      });
    })
    .catch((err) => console.log(err));
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, productData: { ...i.productId._doc } };
      });
      console.log(products);
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user._id,
        },
        items: products,
      });

      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => console.log(err));
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        isLoggedIn: req.session.isLoggedIn,
        orders: orders,
      });
    })
    .catch((err) => console.log(err));
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found"));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized"));
      }
      const invoicename = "invoice-" + orderId + ".pdf";
      const invoicepath = path.join("data", "invoices", invoicename);

      const pdfdoc = new pdfdocument(); //its a readable stream
      res.setHeader("Content-Type", "application/pdf"); //for .pdf extension
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoicename + '"'
      ); //how this file will be named

      pdfdoc.pipe(fs.createWriteStream(invoicepath));
      pdfdoc.pipe(res);

      pdfdoc.fontSize(26).text("Invoice", {
        underline: true,
      });

      pdfdoc.text("----------------------");
      let totalprice = 0;
      order.items.forEach((prod) => {
        totalprice += prod.quantity * prod.productData.price;
        pdfdoc
          .fontSize(14)
          .text(
            prod.productData.title +
              " - " +
              prod.quantity +
              " * " +
              "$" +
              prod.productData.price
          );
      });
      pdfdoc.text("----------");

      pdfdoc.fontSize(18).text("Total Price: $" + totalprice);
      pdfdoc.end();
      // fs.readFile(invoicepath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      // res.setHeader("Content-Type", "application/pdf");
      // res.setHeader('Content-Disposition','attachment; filename="'+ invoicename +'"')
      //   res.send(data);
      // });

      //  --> // const file = fs.createReadStream(invoicepath);
      // res.setHeader("Content-Type", "application/pdf");
      // res.setHeader('Content-Disposition','attachment; filename="'+ invoicename +'"')
      // file.pipe(res);
    })

    .catch((err) => {
      next(err);
    });
};
