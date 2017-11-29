//https://api.coinmarketcap.com/v1/ticker/shield-coin/

const Discord = require("discord.js"); //9.3.1
const Client = new Discord.Client();
const nosql = require("nosql");
const shield = require("./lib/shield")();
var fs = require('fs');
var request = require('request');


//IMPORTANT load backup if not exists
if (!fs.existsSync('uid.nosql')) {
	if (fs.existsSync('../uid.nosql')) {
		fs.createReadStream('../uid.nosql').pipe(fs.createWriteStream('uid.nosql'));
	}
}
//IMPORTANT load backup

var db = nosql.load("uid.nosql");

var cmca = require('coinmarketcap-api');
var cmc = new cmca();

const algos = ["x17", "scrypt", "myrgr", "lyra2v2", "blake2s"];
var MessageQueue = [];
var collectorAddr = "SHIELDADDRESS"; //must be on the same wallet
shield.auth('Macintyre, John', 'mypassword');

var jsonf;
var btcval;


function Update() {
	//IMPORTANT create backup
	fs.truncate("../uid.nosql", 0, function () {
		fs.createReadStream('uid.nosql').pipe(fs.createWriteStream('../uid.nosql'));
	});
	//IMPORTANT create backup
	cmc.getTicker({
		limit: 1,
		currency: 'shield-xsh'
	}).then(x => {
		jsonf = x;
	}).catch(console.log);
	cmc.getTicker({
		limit: 1,
		currency: 'bitcoin'
	}).then(x => {
		btcval = x[0]["price_usd"];
	}).catch(console.log);

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
								Client.channels.get("382625543993950209").sendMessage("<@" + String(element["uid"]) + "> deposited " + String(inf - element["ActualBalance"]) + "XSH");
							});

						});
					}
				});
			}, this);
		});
	});

}

Update();

setInterval(Update, 30 * 1000); //every 30 sec
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
					if (response === undefined) {
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
		GetBalance(uid).then(balance => {
			if (balance >= amount) {
				amount -= 0.05; //Tx fee
				console.log("withdrawing", address, amount)
				shield.exec("sendToAddress", address, amount, function (err, txid) {
					if (err) {
						reject(err);
					}
					GetBalance(uid).then(balance => {
						GetBalance("MainAddr").then(Mainbalance => {
							UpdateBalance(uid, balance - (amount + 0.05));
						});
					});
					resolve(txid);
				});
			} else {
				reject("`not enough balance`");
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

function SendMsg(MessageClass, MessageString) {
	MessageClass.channel.sendMessage(MessageString).then(msg => {
		MessageQueue.unshift(msg);
		if (MessageQueue.length > 5) {
			var ToDelMsg = MessageQueue[4].delete();
			MessageQueue.pop();
		}
	}).catch(x => {
		console.log("Couldn't send message.");
	})

}

GetBalance("MainAddr").then(balance => {
	console.log("Main balance is:" + String(balance));
}).catch(x => {
	AddNewUser("MainAddr").then(x => {
		console.log("MainAddr address is: " + x);
	}).catch(x => {
		console.log("Couldn't make address.", err);
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

	var content = Message.content.toLowerCase().split(/\s+/);
	var mention = Array.from(Message.mentions.users.values());

	if (content[0]  === "!info" && new Date().getTime() > info_last + (1000 * 60 * 1) && (Message.channel.type == "text")) { //wait five minutes interval at least
		//console.log(jsonf);
		var jsons = jsonf[0];
		SendMsg(Message, "XSH || " + jsons["price_btc"] + " BTC || $" + jsons["price_usd"] + " || " + jsons["percent_change_24h"] + "% || 24h vol: " + (jsons["24h_volume_usd"] / btcval).toFixed(4) + " BTC || CMC Rank: " + jsons["rank"]);
		info_last = new Date().getTime();
	}

	if (content[0] === "!deposit" && (Message.channel.type == "text")) {
		GetFromUID(Message.author.id).then(user => {
			SendMsg(Message, "<@" + String(Message.author.id) + ">, Your deposit address is:" + user["deposit_address"]);
		}).catch(err => {
			console.log(err);
			AddNewUser(Message.author.id).then(addr => {
				SendMsg(Message, "<@" + String(Message.author.id) + ">, Your deposit address is: " + addr);
			});
		});
	}

	//TODO: custom amount
	if (content[0]  === "!chance" && (Message.channel.type == "text")) {
		var amount = Number(content[1]);
		if (amount == undefined || isNaN(amount)) {
			amount = 50; //default
		}
		if (amount < 10){
			SendMsg(Message, "Minimum bet is 10XSH");
			return;
		}
		if (amount <= 0) {
			SendMsg(Message, "Smart ass >_>");
			return;
		}
		if(amount > 500){
			SendMsg(Message, "Maximum bet is 500XSH");
			return;
		}
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {
				if (balance >= amount) {
					if (RandomNumber() > 0.51) {
						SendMsg(Message, "<@" + String(Message.author.id) + ">. Nice! You win "+ String(amount) + "XSH!");
						UpdateBalance(Message.author.id, balance + amount);
						UpdateBalance("MainAddr", Mainbalance - amount);
					} else {
						SendMsg(Message, "<@" + String(Message.author.id) + ">. Bad luck! Try again next time!");
						UpdateBalance(Message.author.id, balance - amount);
						UpdateBalance("MainAddr", Mainbalance + amount);
					}
				} else {
					//value for remaining required XSH (amount - balance) was not truncated.
					//use the Math.ceil function
					SendMsg(Message, "Balance insufficient. (you need " + (amount - balance).toFixed(3).replace(/\.?0*$/, '') + " more XSH)");
				}
			});
		}).catch(x => {
			SendMsg(Message, "Your XSH balance is empty. (Hint: use `!deposit`)");
		});
	}

	if (content[0] === "!balance") {
		GetBalance(Message.author.id).then(x => {
			SendMsg(Message, "<@" + String(Message.author.id) + ">, You have: " + String(x) + " XSH");
		}).catch(x => {
			SendMsg(Message, "Your XSH balance is empty. (Hint: use `!deposit`)");
		});
	}


	if (content[0] === "!donate") {
		var amount = Number(content[1]);
		if (amount == undefined || isNaN(amount)) {
			SendMsg(Message, "Please use `!donate <amount>`");
			return;
		}
		if (amount <= 0) {
			SendMsg(Message, "Smart ass >_>");
			return;
		}
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {

				if (balance < amount) {
					SendMsg(Message, "not enough balance");
					return;
				}
				UpdateBalance(Message.author.id, balance - amount);
				UpdateBalance("MainAddr", Mainbalance + amount);

				if (amount > 100000) {
					SendMsg(Message, "<@" + String(Message.author.id) + ">, Thank you so much for your donation! You may choose a custom colour and title.");
					return;
				} else {
					SendMsg(Message, "<@" + String(Message.author.id) + ">, Thanks for the donation!");
				}
			});
		}).catch(x => {
			SendMsg(Message, "Your XSH balance is empty. (Hint: use `!deposit`)");
		});
	}

	if (content[0] === "!withdraw") {
		if (content.length >= 3) {
			var amount = Number(content[1]);
			var address = content[2];

			if (amount == undefined || isNaN(amount)) {
				SendMsg(Message, "Please use `!withdraw <amount> <address>`");
				return;
			}

			WithdrawBalance(Message.author.id, address, amount).then(x => {
				SendMsg(Message, "<@" + String(Message.author.id) + ">, You successfully withdrew " + String(x));
			}).catch(x => {
				SendMsg(Message, "Failed to withdraw funds.");
				console.log(x);
			});
		} else {
			SendMsg(Message, "Please use `!withdraw <amount> <address>`");
		}
	}

	if (content[0] === "!hashprofit") {
		if (content.length >= 3) {
			var amount = Number(content[1]);
			var algo = String(content[2]).toLowerCase();

			if (amount == undefined || isNaN(amount)) {
				SendMsg(Message, "Please use `!hashprofit <hashrate in MH/s> <algo>`");
				return;
			}

			if (algos.indexOf(algo) < 0) {
				SendMsg(Message, "**Unrecognised algo.** Please choose one of the following:\n" +
					"`scrypt, myrgr, lyra2v2, blake2s, x17`");
				return;
			}

			request({
				url: 'https://blockstats.pw/shield/api/',
				json: true
			}, function (error, response, body) {
				if (error) {
					console.log(error);
					SendMsg(Message, "Internal Server error");
					return;
				}
				XSHph = (1000000 * amount * 250 * 3600) / (body["diff_24h"][algo] * 4294967296); //current block reward
				var jsons = jsonf[0];
				var pXSH = jsons["price_usd"];
				SendMsg(Message, "(estimated) Hourly: " + String((XSHph).toFixed(2)) + " XSH ($" + String((XSHph * pXSH).toFixed(2)) + ") || Daily:" +
					String((XSHph * 24).toFixed(2)) + " XSH ($" + String((XSHph * pXSH * 24).toFixed(2)) + ")");
				return;
			});
		} else {
			SendMsg(Message, "Please use `!hashprofit <hashrate in MH/s> <algo>`");
		}
	}

	if (content[0] === "!tip") {
		if (content.length >= 3) {
			//var factor = mention.length;
			var amount = Number(content[2]);
			var totip = mention[0].id;
			if (amount == undefined || isNaN(amount)) {
				SendMsg(Message, "Please use `!tip <Person> <amount>`");
				return;
			}
			GetBalance(Message.author.id).then(balance => {
				GetBalance(totip).then(Mainbalance => {

					if (balance < amount) {
						SendMsg(Message, "not enough balance");
						return;
					}
					UpdateBalance(Message.author.id, balance - amount);
					UpdateBalance(totip, Mainbalance + amount);
					SendMsg(Message, "<@" + String(Message.author.id) + "> has tipped <@" + String(totip) + "> " + amount.toFixed(3) + "XSH");
				}).catch(x => {
					SendMsg(Message, "<@" + String(totip) + "> doesn't have a address yet, let them use !deposit first");
				});
			}).catch(x => {
				SendMsg(Message, "<@" + String(Message.author.id) + "> Your XSH balance is empty. (Hint: use `!deposit`)");
			});
		}else{
			SendMsg(Message, "Please use `!tip <User> <amount>`");
		}
	}

	if (content[0] === "!help") {
		SendMsg(Message, "`!info` View current XSH trading statistics.\n" +
			"`!deposit` Receive your unique XSH deposit address.\n" +
			"`!balance` View your current XSH balance.\n" +
			"`!withdraw <amount> <address>` Withdraw an amount of your XSH to another XSH address (-0.05 network fee).\n" +
			"`!donate <amount>` Donates an amount of XSH to the team.\n" +
			"`!chance [amount]` Try your luck! You can win or lose your amount of XSH.\n" +
			"`!hashprofit <hashrate in MH/s> <algo>` Estimate earnings for a given hashrate on one of XSH's algos.\n" +
			"`!tip <User> <amount>` Will tip a person a amount of xsh");
	}
});



Client.login("TOKEN");