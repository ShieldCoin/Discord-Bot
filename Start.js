//https://api.coinmarketcap.com/v1/ticker/shield-coin/

const Discord = require("discord.js"); //9.3.1
const Client = new Discord.Client();
const https = require('https');
const nosql = require("nosql");
const shield = require("./lib/shield")();
var db = nosql.load("uid.nosql");

var cmca = require('coinmarketcap-api');
var cmc = new cmca();

var collectorAddr = "SHIELDADDRESS"; //must be on the same wallet
shield.auth('Macintyre, John', 'mypassword');

function UpdateDeposits() {
	db.find().make(function (builder) { //Get All users
		builder.callback(function (err, response) {
			response.forEach(function (element) { //Iterate through them
				shield.getreceivedbyaddress(element["deposit_address"], function (err, inf) {
					if (inf > element["ActualBalance"]) {
						db.modify({
							ActualBalance: inf
						}).make(function (builder) {
							builder.first(); // --> modifies only one document
							builder.where('deposit_address', element["deposit_address"]);
							builder.callback(function (err, count) {
								if (err) {
									console.log(err);
								}
								UpdateBalance(element["uid"], element["balance"] + (inf - element["ActualBalance"])); //add the diff of recieved coins
							});

						});
					}
				});
			}, this);
		});
	});

}

setInterval(UpdateDeposits, 60 * 1000); //every 60 sec
//FIXME:Round Down when upgrading balances
function GetNewAddress() {
	return new Promise(function (resolve, reject) {
		let daddress;
		shield.getNewAddress(function (err, address) {
			if (err) {
				reject(err);
				return;
			}
			this.validateaddress(address, function (err, info) {
				if (err) {
					reject(err);
					return;
				}
				daddress = address;
				resolve(daddress);

			})
		})
	})
}

function GetFromUID(uid) {
	return new Promise(function (resolve, reject) {
		db.find().make(function (filter) {
			filter.first();
			filter.where('uid', '=', uid);
			filter.callback(function (err, response) {
				if (err) {
					reject(err);
				} else {
					if(response === undefined){
						reject(0);
					}
					resolve(response);
				}
			});
		});
	});
}


function GetDepositAddress(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(x => {
			resolve(x["deposit_address"]);
		}).catch(err => {
			reject(err);
		});
	});
}

function UpdateBalance(uid, newBalance) {
	db.modify({
		balance: newBalance
	}).make(function (builder) {
		builder.first(); // --> modifies only one document
		builder.where('uid', uid);
		builder.callback(function (err, count) {
			console.log("update balance: " + uid + "; " + String(newBalance));
		});
	});
}

function GetBalance(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(x => {
			resolve(x["balance"]);
		}).catch(err => {
			reject(err);
		});
	});
}


//TODO: implement withdraw addresses
function WithdrawBalance(uid, address, amount) {
	return new Promise(function (resolve, reject) {
		GetBalance(uid).then(balance =>{
			if(balance > amount){
				balance -= 0.05; //Tx fee
				console.log("withdrawing",address,balance)
				shield.exec("sendToAddress", address, balance, function(err,balance){
					if(err){
						reject(err);
						return;
					}
					resolve(balance);
				});
			}
		}).catch(err => {
			reject(err);
		})
	});
}

/* Returns deposit Addr or undefined*/
function AddNewUser(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(response => {
			resolve(response["deposit_address"]);
		}).catch(x => {
			GetNewAddress().then(Naddr => {
				db.insert({
					uid: uid,
					balance: 0,
					deposit_address: Naddr,
					ActualBalance: 0
				}).callback(function (err) {
					if (err) {
						reject(err);
						return;
					}
					resolve(Naddr);
				});
			}).catch(x => {
				reject(x);
			})
		})
	});
}

GetBalance("MainAddr").then(balance => {
	console.log("Main balance is:" + String(balance));
}).catch(x => {
	AddNewUser("MainAddr").then(x => {
		console.log("MainAddr address is: " + x);
	}).catch(x => {
		console.log("Couln't make address", err);
	});
	console.log(x);
});

function RandomNumber() { //dist
	return Math.random();
}

Client.on("ready", () => {
	//console.log( "ColorChange bot has been started!" );
	//Client.user.setGame( "SHIELDbot" );
	Client.user.setStatus("online");
	//var channel = Client.channels.get('general');
	//channel.sendMessage("Back online! again..");
});

var info_last = 0;

Client.on("message", Message => {
	if (Message.author.bot)
		return;

	if (Message.content.toLowerCase().startsWith("!info") && new Date().getTime() > info_last + (1000 * 60 * 1) && (Message.channel.type == "text")) { //wait five minutes interval at least
		cmc.getTicker({
			limit: 1,
			currency: 'shield-xsh'
		}).then(jsonf => {
			console.log(jsonf);
			var jsons = jsonf[0];
			Message.channel.sendMessage("Change: " + jsons["percent_change_24h"] + "%\nVolume: " +
				jsons["24h_volume_usd"] + "$\nRank: " + jsons["rank"] + "\nPrice: " + jsons["price_usd"] + "$\n            " +
				jsons["price_btc"] + "BTC");
			info_last = new Date().getTime();
		}).catch(console.error)
	}

	if (Message.content.toLowerCase().startsWith("!deposit") && (Message.channel.type == "text")) {
		GetFromUID(Message.author.id).then(user => {
			Message.channel.sendMessage("Your deposit address is:" + user["deposit_address"]);
		}).catch(err => {
			console.log(err);
			AddNewUser(Message.author.id).then(addr => {
				Message.channel.sendMessage("Your deposit address is: " + addr);
			});
		});
	}

	//TODO: custom amount
	if (Message.content.toLowerCase().startsWith("!chance") && (Message.channel.type == "text")) {
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {
				if (balance >= 50) {
					if (RandomNumber() > 0.51) {
						Message.channel.sendMessage("Chance! you win 50XSH");
						UpdateBalance(Message.author.id, balance + 50);
						UpdateBalance("MainAddr", Mainbalance - 50);
					} else {
						Message.channel.sendMessage("Bad luck! Try again next time!");
						UpdateBalance(Message.author.id, balance - 50);
						UpdateBalance("MainAddr", Mainbalance + 50);
					}
				} else {
					Message.channel.sendMessage("Not enough balance (50XSH needed)");
				}
			});
		});
	}

	if (Message.content.toLowerCase().startsWith("!balance")) {
		GetBalance(Message.author.id).then(x =>{
			Message.channel.sendMessage("You have: " + String(x) + "XSH");
		}).catch(x=>{
			Message.channel.sendMessage("You haven't deposited any XSH yet (Hint: use `!deposit`)");
		});
	}


	if(Message.content.toLowerCase().startsWith("!donate")){
		var amount = Number(Message.content.split(" ")[1]);
		if (amount === undefined) {
			Message.channel.sendMessage("Use !donate <amount>");
			return;
		}
		if(amount < 1){
			Message.channel.sendMessage("Smart ass");
			return;
		}
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {

			UpdateBalance(Message.author.id, balance - amount);
			UpdateBalance("MainAddr", Mainbalance + amount);

				if (amount > 100000) {
					Message.channel.sendMessage("Thanks your the donation you can now choose a custom title");
					return;
				}else{
					Message.channel.sendMessage("Thanks for the donation.");
				}
			});
		});
	}

	if (Message.content.toLowerCase().startsWith("!withdraw")) {
		if (Message.content.split(" ").Length !== 3) {
			var amount = Number(Message.content.split(" ")[1]);
			var address = Message.content.split(" ")[2];

			if (amount === undefined) {
				Message.channel.sendMessage("Use !withdraw <amount> <address>");
				return;
			}
			if (address === undefined) {
				Message.channel.sendMessage("Use !withdraw <amount> <address>");
				return;
			}

			WithdrawBalance(Message.author.id, address, amount).then(x => {
				Message.channel.sendMessage("Succesfully withdrawed " + String(x) + "XSH");
			}).catch(x => {
				Message.channel.sendMessage("Failed to withdraw funds");
				console.log(x);
			});
		}
	}

});



Client.login("TOKEN");