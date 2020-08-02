var express = require('express');
var https = require('https');
var path = require('path');
var Mailchimp = require('mailchimp-api-v3');

const bodyParser = require('body-parser');
const request = require('request');
const fetch = require('node-fetch');
const ejs = require('ejs');

const cheerio = require('cheerio');

const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;

require('dotenv').config();

var app = express();

const myKey = process.env.MAILCHIMP_API_KEY;
const myList = process.env.MAILCHIMP_AUDIENCE_ID;

var mailchimp = new Mailchimp(myKey);


app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs');
app.set('port', (process.env.PORT || 8000));

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

async function insertNewPosts(client, items) {
	var dbo = client.db('medium-posts');
	items.forEach((item) => {
		dbo.collection('medium-posts').insertOne({
			title: item.title,
			pubDate: item.pubDate,
			link: item.link,
			thumbnail: item.thumbnail,
			categories: item.categories
		})
		.then((result) => {
			console.log("Successfully inserted medium post");
		})
		.catch((err) => {
			console.log(err);
		});
	});
}

async function insertPosts(client, items) {
	var dbo = client.db('medium-posts');
	// console.log(items);
	items.forEach((item) => {
		dbo.collection('medium-posts').find({title: item.title}, {limit: 1}).count()
		.then((numItems) => {
			// console.log(numItems);
			if (!numItems) {
				console.log("Inserting new post into database");
				dbo.collection('medium-posts').insertOne({
					title: item.title,
					pubDate: item.pubDate,
					link: item.link,
					thumbnail: item.thumbnail,
					categories: item.categories
				})
				.then((result) => {
					console.log("Successfully inserted medium post");
				})
				.catch((err) => {
					console.log(err);
				});
			}
		})
		.catch((error) => {
			console.log(error);
		});
	});
}

// Alert Message Middleware
function messages(req, res, next) {
	var message, description;
	res.locals.message = message;
	var items = [];
	var itemsDescription = [];
	var itemsCategories = [];
	fetch('https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/augment-official')
	.then((res) => res.json())
	.then((data) => {
		// Insert new database entries
		async function insert() {
			const uri = process.env.MONGODB_URI;

			const client = new MongoClient(uri, {
				useNewUrlParser: true,
				useUnifiedTopology: true
			});
			try {
				await client.connect();
				// await insertNewPosts(client, data.items);
				await insertPosts(client, data.items);
			} catch(err) {
				console.log(err);
			}
		}
		insert().catch(console.error);

		// Retrieve all database entries
		async function retrieve() {
			const uri = process.env.MONGODB_URI;
			const client = new MongoClient(uri, {
				useNewUrlParser: true,
				useUnifiedTopology: true
			});
			try {
				await client.connect();
				var ans = [];
				var dbo = client.db('medium-posts');
				var cursor = dbo.collection('medium-posts').find({}).sort({pubDate: -1});
				if (!cursor.count()) {
					console.log("No medium posts found");
					return;
				}
				cursor.forEach(function(doc, err) {
					ans.push(doc);
				}, function() {
					client.close();
					res.locals.blogItems = ans;
					ans.forEach((elem) => {
						var len = elem.categories.length;
						var tags = "";
						for (var i=0; i<len; i++) {
							tags += elem.categories[i];
							if (i < len - 1) {
								tags += ", ";
							}
						}
						itemsCategories.push(tags);
					});
					res.locals.blogCategories = itemsCategories;
					next();
				});
			} catch(err) {
				console.log(err);
			}
		}
		retrieve().catch(console.error);
	})
	.catch((error) => {
		console.log(error);
		res.locals.blogItems = [];
		res.locals.blogCategories = [];
		next();
	});
}

app.get('/', messages, (req, res) => {
	res.render('pages/index');
});

app.get('/about', messages, (req, res) => {
	res.render('pages/about');
});

app.get('/events', messages, (req, res) => {
	res.render('pages/events');
});

app.get('/articles', messages, (req, res) => {
	res.render('pages/articles');
});

app.get('/contact', messages, (req, res) => {
	res.render('pages/contact');
});

app.post('/submit-form', messages, (req, res) => {
	var email = req.body.email
	var firstName = req.body['first-name'];
	var occupation = req.body.occupation;
	var interestedCareer = req.body['interested-career'];
	var careerRole = req.body['career-role'];

	var add_new_member = {
		method: 'POST',
		path: '/lists/' + myList + '/members',
		body: {
			email_address: email,
			status: 'subscribed',
			merge_fields: {
				'FNAME': firstName,
				'OCCUPATION': occupation,
				'CAREER': interestedCareer,
				'CAREERROLE': careerRole.length > 0 ? careerRole : "N/A"
			}
		}
	}
	console.log(add_new_member);
	mailchimp.post(add_new_member)
	.then(() => {
		console.log(email + ' added to contact list');
		res.locals.message = "Thanks for subscribing " + firstName + "!";
		res.locals.alertType = "alert-success";
		res.render('pages/index');
	})
	.catch((error) => {
		console.log('Error: ' + error.title);
		console.log('Details: ' + error.detail);
		console.log('Status: ' + error.status);
		if (error.title === "Member Exists") {
			res.locals.message = "You're already subscribed!";
			res.locals.alertType = "alert-warning";
			res.render('pages/index');
		} else if (error.title === "Invalid Resource") {
			if (error.detail.indexOf("looks fake or invalid") !== -1) {
				res.locals.message = "Invalid or fake email. Try again.";
				res.locals.alertType = "alert-danger";
			} else if (error.detail === "Your merge fields were invalid.") {
				res.locals.message = "Invalid input! Try again.";
				res.locals.alertType = "alert-danger";
			}
			res.render('pages/index');
		} else {
			res.locals.message = "An error occurred. Try again.";
			res.locals.alertType = "alert-danger";
			res.render('pages/index');
		}
	})
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
