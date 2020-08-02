var express = require('express');
var https = require('https');
var path = require('path');
var Mailchimp = require('mailchimp-api-v3');

const bodyParser = require('body-parser');
const request = require('request');
const fetch = require('node-fetch');
const ejs = require('ejs');

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

function messages(req, res, next) {
	var message;
	res.locals.message = message;
	next();
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

app.get('/articles', (req, res) => {
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
				res.locals.message = "One of your inputs are invalid. Try again.";
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
