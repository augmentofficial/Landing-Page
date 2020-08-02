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

app.get('/', (req, res) => {
	res.locals.message = "";
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
	var add_new_member = {
		method: 'POST',
		path: '/lists/' + myList + '/members',
		body: {
			email_address: email,
			status: 'subscribed'
		}
	}
	mailchimp.post(add_new_member)
	.then(() => {
		console.log(email + ' added to contact list');
		res.locals.message = "Thanks for subscribing!";
		res.locals.alertType = "alert-success";
		res.render('pages/index');
	})
	.catch((error) => {
		console.log('Error: ', error.title);
		console.log('Details: ', error.detail);
		console.log('Status: ', error.status);
		if (error.title === "Member Exists") {
			res.locals.message = "Member Exists Already!";
			res.locals.alertType = "alert-warning";
			res.render('pages/index');
		} else {
			res.locals.message = "An error occurred. Try again.";
			res.locals.alertType = "alert-danger";
			res.redirect('pages/index');
		}
	})
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
