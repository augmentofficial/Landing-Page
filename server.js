var express = require('express');
var https = require('https');
var path = require('path');
var Mailchimp = require('mailchimp-api-v3');

const bodyParser = require('body-parser');
const request = require('request');
const fetch = require('node-fetch');
const ejs = require('ejs');

const cheerio = require('cheerio');

const MongoClient = require('mongodb').MongoClient

require('dotenv').config();

var app = express();

const myKey = process.env.MAILCHIMP_API_KEY;
const myList = process.env.MAILCHIMP_AUDIENCE_ID;

var mailchimp = new Mailchimp(myKey);

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs');
app.set('port', (process.env.PORT || 8000));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

MongoClient.connect('mongodb-connection-string', (err, client) => {
});

function getMediumArticles() {
	fetch('https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/augment-official')
	.then((res) => res.json())
	.then((data) => {
		return data.items;
	})
	.catch((error) => {
		return [];
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
		items = data.items;
		items.forEach((element) => {
			const $ = cheerio.load(element.content);
			var pTags = $('p').html();
			pTags = pTags.replace(/<br>/gi, "\n");
			pTags = pTags.replace(/<p.*>/gi, "\n");
			pTags = pTags.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, " $2 (Link->$1) ");
			pTags = pTags.replace(/<(?:.|\s)*?>/g, "");
			itemsDescription.push(pTags);

			var tags = "";
			var len = element.categories.length;
			for (var i=0; i<len; i++) {
				tags += element.categories[i];
				if (i < len - 1) {
					tags += ", ";
				}
			}
			itemsCategories.push(tags);
		});
		res.locals.blogItems = items;
		res.locals.blogCategories = itemsCategories;
		next();
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

app.get('/about', (req, res) => {
	res.render('pages/about');
});

app.get('/events', (req, res) => {
	res.render('pages/events');
});

app.get('/articles', messages, (req, res) => {
	res.render('pages/articles');
});

app.get('/contact', (req, res) => {
	res.render('pages/contact');
});

app.post('/submit-form', (req, res) => {
	var email = req.body.email
	var firstName = req.body['first-name'];
	var occupation = req.body.occupation;
	var interestedCareer = req.body['interested-career'];
	var careerRole = req.body['career-role'];
	console.log('Email: ' + email);
	console.log('First Name: ' + firstName);
	console.log('Occupation: ' + occupation);
	console.log('Interested Career: ' + interestedCareer);
	console.log('Career Role: ' + careerRole);

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
