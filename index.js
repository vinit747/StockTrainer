var express = require("express");
var bodyParser=require("body-parser");
var http=require("http");
var app = express();
var fs = require('fs');
var db = require('./db');
var nodemailer = require('nodemailer');
var session = require('express-session')
var user=new db.User();
var stock=new db.Stock();
var watch=new db.Watch();
var history=new db.History();
var moment = require('moment-timezone');
var port = process.env.PORT || 5000;
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var CronJob = require('cron').CronJob;
var interval=60;
var ticker;

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gbolosta@gmail.com',
        pass: '6022141517673245'
    }
});

var check = function(acc,res){
    if(acc == undefined){
        res.redirect("/");
    }
}

var writeStock = function(url,name,callback){
    http.get(url, function(res){
        var body = '';
        res.on('data', function(chunk){
        body += chunk;
    });
    res.on('end', function(){
        var tJson = JSON.parse(body);
        if(tJson.hasOwnProperty('Error Message')){
            if (callback) callback(false);
        }else{
            fs.writeFileSync(name+'.json', JSON.stringify(tJson));
            if (callback) callback(true);
        }
    });

    }).on('error', function(e){
          console.log("Got an error: ", e);
    });
}

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());
app.use(session({
    secret: "Hello There", // connect-mongo session store
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname ));

new CronJob('* 5 9  * * 1-5', function() {
    var tickers=["XELB"];
    for(ticker in tickers){
        var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol='+tickers[ticker]+'&interval=1min&apikey=1977';
        http.get(url, function(res){
            var body = '';
            res.on('data', function(chunk){
                body += chunk;
            });
            res.on('end', function(){
                var tJson = JSON.parse(body);
                fs.writeFileSync("temp/"+ticker+'.json', JSON.stringify(tJson));
                var obj;
                fs.readFile('temp/'+ticker+".json", 'utf8', function (err, data) {
                    if (err) throw err;
                    obj = JSON.parse(data);
                    var date=obj["Meta Data"]["3. Last Refreshed"];
                    var symbol=obj["Meta Data"]["2. Symbol"];
                    var store=parseInt(moment(date).format("DD"));
                    obj=obj["Time Series (1min)"];
                    var obj2=obj[date];
                    var price=obj2["4. close"];
                    price=parseFloat(price);
                    for(date in obj){
                        var check=parseInt(moment(date).format("DD"));
                        if(store - check == 1 || store - check == 3){
                            var price2=parseFloat(obj[date]["4. close"]);
                            var perc=(100)*(price-price2)/price2;
                            if(perc >= 2.0 || (-1*perc) >= 2.0){
                                var uod;
                                if(perc <= -2.0){
                                    uod="down";
                                }else{
                                    uod="up";
                                }
                                var message='Your stock given by ticker '+symbol+'has gone '+uod+' by '+perc+' percent.';    
                                watch.findByTicker(symbol,function(data){
                                    for(users in data){
                                        user.findByUsername(data[users].username,function(data){    
                                            let mailOptions = {
                                                from: '"Gaurav" <gbolosta@gmail.com>', 
                                                to: data.email,
                                                subject: 'Stock fluctuation', 
                                                text: message
                                            };
                                            transporter.sendMail(mailOptions,function(error, info){
                                                if (error) {
                                                    console.log(error);
                                                }
                                            });
                                        });
                                    }
                                });
                            }
                            break;
                        }
                    }
                });        
            });
        }).on('error', function(e){
        console.log("Got an error: ", e);
        });
    }
}, null, true,'America/New_York');
new CronJob('0 0 0 0 0-11 *', function() {
    db.User.update({},{balance:5000},{multi:true});
    db.Stock.remove({});
    db.History.remove({});
}, null, true,'America/New_York');


passport.use(new LocalStrategy(
  function(username, password, done) {
    db.User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));
app.set('view engine', 'ejs');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.post('/stock', function(req, res){
    ticker=req.body.ticker;
    res.sendFile('stock.html', { root: __dirname} );
});
app.post('/stocklogged', function(req, res){
    ticker=req.body.ticker;
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    watch.findByUandS(acc,ticker,function(data){
        var watching;
        if(data == null){
            watching = false;
        }else{
            watching = true;
        }
        res.render('stock',{acc:acc,watching:watching});
    });
});
app.get('/stocklogged', function(req, res){
    ticker=req.body.ticker;
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    watch.findByUandS(acc,ticker,function(data){
        var watching;
        if(data == null){
            watching = false;
        }else{
            watching = true;
        }
        res.render('stock',{acc:acc,watching:watching});
    });

});
app.get('/chart', function(req, res){
    res.sendFile('chart.html', { root: __dirname} );
});
app.get('/currency', function(req, res){
    var url="http://api.fixer.io/latest?base=USD";
    writeStock(url,"currency");    
    res.sendFile('currency.html', { root: __dirname} );
});
app.get('/currencylogged', function(req, res){
    var url="http://api.fixer.io/latest?base=USD";
    writeStock(url,"currency");    
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    res.render('currency',{acc:acc});
});
app.post('/watch',function(req,res){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    var ticker=req.body.ticker;
    watch.create(ticker,acc);
    res.render('stock',{acc:acc,watching:true});
});
app.post('/unwatch',function(req,res){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    var ticker=req.body.ticker;
    watch.removeByUandS(acc,ticker);
    res.render('stock',{acc:acc,watching:false});
});
var timeCheck = function(){
    var time = parseInt(moment().tz("America/New_York").format("HH"));
    var time2 = parseInt(moment().tz("America/New_York").format("mm"));
    var time3 = parseInt(moment().tz("America/New_York").format("d"));
    if((time >= 9 && time2 >= 30) && (time <= 16 && time2 <= 0) && (time3 % 6 != 0)){
        return true;
    }else{
        return false;
    }
}
app.post('/buy',function(req,res){
    var qty=req.body.qty;
    var ticker=req.body.ticker;
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;    
    qty=parseInt(qty);
    var hold=res;
    //var check = timeCheck();
    var checker = true;
    if(checker == false){
        hold.send("The stock market is closed, please buy when it opens");
    }else{
        var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol='+ticker+'&interval=1min&apikey=1977';
        http.get(url, function(res){
            var body = '';
            res.on('data', function(chunk){
            body += chunk;
        });
        res.on('end', function(){
            var tJson = JSON.parse(body);
            fs.writeFileSync("temp/"+ticker+'.json', JSON.stringify(tJson));
            var obj;
            fs.readFile('temp/'+ticker+".json", 'utf8', function (err, data) {
                 if (err) throw err;
                 obj = JSON.parse(data);
                 var date=obj["Meta Data"]["3. Last Refreshed"];
                 obj=obj["Time Series (1min)"][date];
                 var price=obj["4. close"];
                 price=parseFloat(price);
                 user.findByUsername(acc,function(data){
                    var balance=parseFloat(data.balance);
                    if(price*qty > balance){
                        hold.status(305);
                        hold.send("You do not have sufficient balance");
                    }else{
                        balance=balance-price*qty;
                        balance=parseFloat(balance).toFixed(2);
                        user.updateBalance(acc,balance);
                        var date=moment().format("YYYY-MM-DD HH:mm");
                        history.create(ticker,acc,price,qty,date,"Bought");
                        stock.findByUandS(acc,ticker,obj['close'],function(data,price){
                            if(data == null){
                                stock.create(acc,ticker,qty);
                            }else{
                                var cqty=data.quantity;
                                qty=cqty+qty;
                                stock.updateByUandS(acc,ticker,qty)
                            }
                        });
                        hold.send("Stocks bought successfully, your new balance is " + balance);
                    }
                });
            });        
        });
        }).on('error', function(e){
              console.log("Got an error: ", e);
        });
    }
});

app.post('/sell',function(req,res){
    var qty=req.body.qty;
    var ticker=req.body.ticker;
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;    
    qty=parseInt(qty);
    var hold=res;
    //var check = timeCheck();
    var checker = true;
    if(checker == false){
        hold.send("The stock market is closed, please sell when it opens");
    }else{
        var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol='+ticker+'&interval=1min&apikey=1977';
        http.get(url, function(res){
            var body = '';
            res.on('data', function(chunk){
            body += chunk;
        });
        res.on('end', function(){
            var tJson = JSON.parse(body);
            fs.writeFileSync("temp/"+ticker+'.json', JSON.stringify(tJson));
            var obj;
            fs.readFile('temp/'+ticker+".json", 'utf8', function (err, data) {
                 if (err) throw err;
                 obj = JSON.parse(data);
                 var date=obj["Meta Data"]["3. Last Refreshed"];
                 obj=obj["Time Series (1min)"][date];
                 var price=obj["4. close"];
                 price=parseFloat(price);
                 user.findByUsername(acc,function(data){
                    var balance=parseFloat(data.balance);
                    balance=balance+price*qty;
                    balance=parseFloat(balance).toFixed(2);
                    stock.findByUandS(acc,ticker,obj['4. close'],function(data,price){
                        if(data == null){
                            hold.status(305);
                            hold.send("You do not have stocks of this company");
                        }else{
                            user.updateBalance(acc,balance);
                            var date=moment().format("YYYY-MM-DD HH:mm z");
                            history.create(ticker,acc,price,qty,date,"Sold");
                            var cqty=data.quantity;
                            if(qty > cqty){
                                hold.status(305);
                                hold.send("You do not have those many stocks to sell");
                            }else{
                                qty=cqty-qty;
                                if(qty == 0){
                                    stock.removeByUandS(acc,ticker);
                                }else{
                                    stock.updateByUandS(acc,ticker,qty);
                                }
                                hold.send("Stocks sold successfully, your new balance is " + balance);
                            }
                        }
                    });
                });
            });        
        });
        }).on('error', function(e){
              console.log("Got an error: ", e);
        });
    }
});

app.get('/history',function(req,res){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    var historys={"hists":[]};
    history.findByUsername(acc,function(data){
        for(var i=0;i<data.length;i++){
            var hist={"ticker":data[i].ticker,"price":data[i].price,"quantity":data[i].quantity,"pdate":data[i].pdate,"ttype":data[i].bos};
            historys["hists"].push(hist);
        }
        res.render('history',{acc:acc,hists:historys});
    });
});

app.get('/ranking',function(req,res){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;
    var ranks = {"ranks":[]};
    db.User.find().sort({"balance":-1}).limit(100).exec(function(err,data){
        for(var i=0;i<data.length;i++){
            var rank={"username":data[i].username,"balance":data[i].balance};
            ranks["ranks"].push(rank);
        }
        res.render('leaderboard',{acc:acc,ranks:ranks});
    });
});

app.get('/watchlist',function(req,res,next){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;  
    var up={"stocks":[]};
    var down={"stocks":[]};        
    watch.findByUsername(acc,function(user){
        if(user == ""){
            res.render('watchlist',{acc:acc,up:up,down:down});    
        }else{
            for(var i=0;i < user.length;i++){
                var ticker=user[i].ticker;
                var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol='+ticker+'&apikey=1977';
                var check = writeStock(url,"daily/"+ticker);
                var obj;
                fs.readFile('daily/'+ticker+".json", 'utf8', function (err, data) {
                      if (err) throw err;
                      obj = JSON.parse(data);
                      var symbol=obj["Meta Data"]["2. Symbol"]; 
                      var date=obj["Meta Data"]["3. Last Refreshed"];
                      obj=obj["Time Series (Daily)"];
                      var count=0;
                      var obj2;
                      for(var date2 in obj){
                          if(count == 1){
                            obj2=obj[date2];
                            break;
                          }
                          count+=1;
                      }                  
                      obj=obj[date];
                      ud=[];
                      for(var price in obj){
                          if(obj[price]-obj2[price] > 0){
                              ud.push(true);  
                          }else{
                              ud.push(false);
                          }
                      }
                      var stock={"ticker":symbol,"open":{"data":parseFloat(obj['1. open']).toFixed(2),"ud":ud[0]},"close":{"data":parseFloat(obj['4. close']).toFixed(2),"ud":ud[3]},"high":{"data":parseFloat(obj['2. high']).toFixed(2),"ud":ud[1]},"low":{"data":parseFloat(obj['3. low']).toFixed(2),"ud":ud[2]}};
                      if(ud[3] == true){
                          up["stocks"].push(stock);
                      }else{
                          down["stocks"].push(stock);
                      }
                      if(i == user.length && symbol == ticker){
                          res.render('watchlist',{acc:acc,up:up,down:down});             
                      }
                });
            }
        }
    });
});
app.get('/ticker',function(req,res){
    res.send(ticker);
});
app.get('/loggedin',function(req,res){
    check(req.session.passport,res);
    var acc=req.session.passport.user.username;  
    var stocks={"stocks":[]};
    stock.findByUsername(acc,function(users){
        if(users == ""){
            user.findByUsername(acc,function(users){
                db.User.find({ balance : { $gt : users.balance }}).count(function(err,count){
                    res.render('profile',{acc:acc,email:users.email,balance:users.balance,total: 0, rank:count+1 ,stocks:stocks}); 
                });  
            });   
        }
        var total=0;
        for(var i=0;i < users.length;i++){
            var ticker=users[i].ticker;
            var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol='+ticker+'&apikey=1977';
            writeStock(url,"daily/"+ticker);
            var obj;
            fs.readFile('daily/'+ticker+".json", 'utf8', function (err, data) {
                  if (err) throw err;
                  obj = JSON.parse(data);
                  var symbol=obj["Meta Data"]["2. Symbol"]; 
                  var date=obj["Meta Data"]["3. Last Refreshed"];
                  obj=obj["Time Series (Daily)"];
                  var count=0;
                  var obj2;
                  for(var date2 in obj){
                      if(count == 1){
                        obj2=obj[date2];
                        break;
                      }
                      count+=1;
                  }                  
                  obj=obj[date];
                  var up;
                  if(obj['4. close'] > obj2['4. close']){
                    up=true;
                  }else{
                    up=false;
                  }
                  stock.findByUandS(acc,symbol,obj['4. close'],function(data,price){
                      total+=data.quantity;
                      var stocker={"ticker":data.ticker,"quantity":data.quantity,"value":parseFloat(price*data.quantity).toFixed(2),"up": up};
                      stocks["stocks"].push(stocker);
                      if(i == users.length && symbol == ticker){
                        user.findByUsername(acc,function(user){
                            db.User.find({ balance : { $gt : user.balance }}).count(function(err,count){
                                res.render('profile',{acc:acc,email:user.email,balance:user.balance,total: total, rank:count+1 ,stocks:stocks}); 
                            }); 
                            
                        });            
                      }
                  });
            });
        }
    });
});
app.get('/logout', function (req, res){
  req.session.destroy(function (err) {
    res.redirect('/');
  });
});

app.post('/register',function(req,res){
    var uname=req.body.un;
    var eml=req.body.email;
    var pass=req.body.password;
    var cpass=req.body.cpassword;
    var message;
    var check1= /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/.test(eml);
    var check2= /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$@$!%*?&])[A-Za-z\d$@$!%*?&]{8,}/.test(pass);
    if(check1 == false){
        res.status(400);
        res.send("Enter a valid email, please");
    }else if(check2 == false){
        res.send("Enter a strong enough password, please");
    }else{
        if(pass != cpass){
            res.status(400);
            message="Passwords do not match";
        }
        db.User.find({$or : [{username:uname},{email:eml}]}, function(err, data) {
          if (err) throw err;
          if(data == "" && pass == cpass){
              user.create(uname,pass,eml,5000);
              res.sendFile('index.html', { root: __dirname} );
          }else if(data != ""){
              user.findByUsername(uname,function(data){
                    res.status(400);
                    if(data != null){
                        message="Username already exists";
                    }else if(pass != cpass){
                        message="Passwords do not match";
                    }else{
                        message="Email already exists";
                    }
                    res.send(message);
              });
          }
        });
    }
});

app.post('/login',
    passport.authenticate('local', { successRedirect: '/loggedin',failureRedirect: '/' })
);



app.post('/time',function(req, res){ 
      var body = req.body;
      interval=body.number;
      var url = 'http://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol='+ticker+'&interval='+interval+'min&apikey=1977';
      var url2 = 'http://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol='+ticker+'&apikey=1977';
      var url3 = 'http://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol='+ticker+'&apikey=1977';
      var url4 = 'http://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol='+ticker+'&apikey=1977';
      var check = writeStock(url,"interval",function(check){
          if(check == false){
              res.status(400);
              res.send("The entered stock ticker does not exist in out database");
          }else{
              writeStock(url2,"daily/"+ticker);
              writeStock(url3,"weekly");    
              writeStock(url4,"monthly");        
              res.send("OK");
          }
      });  
      
});

app.listen(port, function() {
  console.log("Listening on " + port);
});
