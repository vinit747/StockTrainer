var mongoose = require('mongoose');
//mongoose.connect('mongodb://GauravB:gbgb@ds135830.mlab.com:35830/stockwatch');
mongoose.connect('mongodb://localhost:27017/stockwatch');
var db = mongoose.connection;
var Schema=mongoose.Schema;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("Connected");
});
var userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email:{ type:String,required:true, unique: true},
  balance:{ type: Number, required:true}
});

var watchSchema = new Schema({
  ticker:{type: String, required: true},
  username: { type: String, required: true} 
});

var stockSchema = new Schema({
  ticker:{type: String, required: true},
  username: { type: String, required: true},
  quantity: {type:Number,required:true}
});
var historySchema = new Schema({
  ticker:{type: String, required: true},
  username: { type: String, required: true},
  price: {type: Number,required:true},
  quantity: {type:Number,required:true},
  pdate: {type: String, required:true},
  bos: {type:String,required:true}
});
userSchema.methods.create = function(uname,pwd,eml,blnc){
    var temp = mongoose.model('User',userSchema)({
      username: uname,
      password: pwd,
      email:eml,
      balance:blnc
    });
    temp.save(function(err) {
      if (err) throw err;
    });
}

userSchema.methods.findByUsername = function(uname,callback){
    this.model('User').findOne({ username: uname }, function(err, user) {
      if (err) throw err;
      callback(user);
    });
}

userSchema.methods.findByEmail = function(eml,callback){
    this.model('User').findOne({ email: eml }, function(err, user) {
      if (err) throw err;
      callback(user);
    });
}

userSchema.methods.printAllUsers = function(){
    this.model('User').find({}, function(err, users) {
      if (err) throw err;
    });
}

userSchema.methods.removeByUsername = function(uname){
    this.model('User').findOneAndRemove({ username: uname }, function(err) {
      if (err) throw err;
    });
}
userSchema.methods.updateBalance = function(uname,balance){
    this.model('User').findOneAndUpdate({username:uname}, {balance:balance}, function(err, doc){
    if (err) console.log(err);
});
}
userSchema.methods.validPassword = function( pwd ) {
    return ( this.password === pwd );
};
watchSchema.methods.create = function(tick,uname){

    var temp = mongoose.model('Watch',watchSchema)({
      ticker:tick,
      username:uname
    });
    temp.save(function(err) {
      if (err) throw err;
    });
}

watchSchema.methods.printAllUsers = function(){
    this.model('Watch').find({}, function(err, users) {
      if (err) throw err;
    });
}

watchSchema.methods.removeByUsername = function(uname){
    this.model('Watch').findOneAndRemove({ username: uname }, function(err) {
      if (err) throw err;
    });
}

watchSchema.methods.findByUsername = function(uname,callback){
    this.model('Watch').find({ username: uname }, function(err, user) {
      if (err) throw err;
      callback(user);      
    });
}

watchSchema.methods.findByTicker = function(tick,callback){
    this.model('Watch').find({ ticker: tick }, function(err, user) {
      if (err) throw err;
      callback(user);
    });
}
watchSchema.methods.findByUandS = function(uname,tick,callback){
    this.model('Watch').findOne({ username: uname,ticker:tick }, function(err,user) {
      if (err) throw err;
      callback(user);
    });
}
watchSchema.methods.removeByUandS = function(uname,tick){
    this.model('Watch').findOneAndRemove({ username: uname,ticker:tick }, function(err) {
      if (err) throw err;
    });
}
stockSchema.methods.create = function(uname,tick,qty){
    var temp = mongoose.model('Stock',stockSchema)({
      ticker:tick,
      username:uname,
      quantity:qty
    });
    temp.save(function(err) {
      if (err) throw err;
    });
}
stockSchema.methods.printAllStocks = function(){
    this.model('Stock').find({}, function(err, users) {
      if (err) throw err;
    });
}
stockSchema.methods.findByUsername = function(uname,callback){
    this.model('Stock').find({ username: uname }, function(err, user) {
      if (err) throw err;
      callback(user);
    });
}
stockSchema.methods.findByUandS = function(uname,tick,price,callback){
    this.model('Stock').findOne({ username: uname,ticker:tick }, function(err,user) {
      if (err) throw err;
      callback(user,price);
    });
}
stockSchema.methods.updateByUandS = function(uname,tick,qty){
    this.model('Stock').findOneAndUpdate({ username: uname,ticker:tick },{quantity:qty}, function(err) {
      if (err) throw err;
    });
}
stockSchema.methods.removeByUandS = function(uname,tick){
    this.model('Stock').findOneAndRemove({ username: uname,ticker:tick }, function(err) {
      if (err) throw err;
    });
}
historySchema.methods.create = function(tick,uname,prce,qty,pdate,bos){
    var temp = mongoose.model('History',historySchema)({
      ticker:tick,
      username:uname,
      price:prce,
      quantity:qty,
      pdate:pdate,
      bos:bos
    });
    temp.save(function(err) {
      if (err) throw err;
    });
}
historySchema.methods.printAllStocks = function(){
    this.model('History').find({}, function(err, users) {
      if (err) throw err;
    });
}
historySchema.methods.findByUsername = function(uname,callback){
    this.model('History').find({ username: uname }).sort('-pdate').exec(function(err, user) {
      if (err) throw err;
      callback(user);
    });
}
historySchema.methods.findByUandS = function(uname,tick,callback){
    this.model('History').find({ username: uname,ticker:tick }, function(err,user) {
      if (err) throw err;
      callback(user);
    });
}
var Stock = mongoose.model('Stock',stockSchema);
var History = mongoose.model('History',historySchema);
var User = mongoose.model('User', userSchema);
var Watch=mongoose.model('Watch',watchSchema);
module.exports = {
    User: User,
    Stock:Stock,
    Watch:Watch,
    History:History
};

