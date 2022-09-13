/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');

//apla resources
const audioDocument = require('./mixaudio.json');
const sequenceDocument = require('./sequence.json');


const util = require('./util.js')
const AUDIO_TOKEN = "AudioToken";
const SEQUENCE_TOKEN = "SequenceToken";

//import resources from s3 bucket
const introsound = util.getS3PreSignedUrl("Media/intro-harp.mp3").replace(/&/g,'&amp;')
const outrosound = util.getS3PreSignedUrl("Media/outro-harp.mp3").replace(/&/g,'&amp;')
const correctsound = util.getS3PreSignedUrl("Media/Correct-answer.mp3").replace(/&/g,'&amp;')
const incorrectsound = util.getS3PreSignedUrl("Media/Wrong-answer.mp3").replace(/&/g,'&amp;')


// are you tracking past quotes between sessions
const quotes_tracking = true;

//set some context by storing the asked question in a session attribute
function setQuestion(handlerInput, questionAsked) {
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  sessionAttributes.questionAsked = questionAsked;
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
}



//set some context by storing either a warmup question or a round one question etc. in a session attribute
function setQuestionType(handlerInput, questionType) {
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  sessionAttributes.questionType = questionType;
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
}

//used for apla response
let responseBuilder;



const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
            //set up our Settings api foundations
    const serviceClientFactory = handlerInput.serviceClientFactory;
    const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

    // initialize some variables
    var userTimeZone, greeting;

    // wrap the API call in a try/catch block in case the call fails for
    // whatever reason.
    try {
        const upsServiceClient = serviceClientFactory.getUpsServiceClient();
        userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
    } catch (error) {
        userTimeZone = "error";
        console.log('error', error.message);
    }

    // calculate our greeting
    if(userTimeZone === "error"){
        greeting = "Hello.";
    } else {
        // get the hour of the day or night in your customer's time zone
        const wfunctions = await require('./warmupFunctions.js');
        var hour = wfunctions.getHour(userTimeZone);
        if(0<=hour&&hour<=4){
            greeting = `<amazon:effect name="whispered">Hi night-owl<break strength="medium"/></amazon:effect>`

        } else if (5<=hour&&hour<=11) {
            greeting = `<amazon:emotion name="excited" intensity="high">
                                Good Morning
                            </amazon:emotion>
                            <break strength="medium"/>`
        } else if (12<=hour&&hour<=17) {
            greeting = `<amazon:emotion name="excited" intensity="medium">
                                Good Afternoon
                            </amazon:emotion>
                            <break strength="medium"/>`
        } else if (17<=hour&&hour<=23) {
            greeting = `<amazon:emotion name="excited" intensity="low">
                                Good Evening
                            </amazon:emotion>
                            <break strength="medium"/>`
        } else {
            greeting = `<amazon:emotion name="excited" intensity="medium">
                                Howdy partner
                            </amazon:emotion>
                            <break strength="medium"/>`
        }
    }
        
        
        let speakOutput = "";
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
     
        if(sessionAttributes.name === null && sessionAttributes.visits >= 1){
            speakOutput = `${greeting} Welcome back to who said that, looks like I never got your name,`;
             sessionAttributes.visits += 1;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .addDelegateDirective({
                name: 'GetNameIntent',
                confirmationStatus: 'NONE',
                slots: {}
            })
            .getResponse();
            }

        if(sessionAttributes.visits === 0){
        setQuestion(handlerInput, 'PlayGameOrNot');
         speakOutput = `${greeting} Welcome to who said that, here you will listen to well known quotes from histories greatest men and women then must guess the author of each quote out of three options, as you gain points you will unlock new more difficult levels, would you like to play?`;

        } else {
            let name = sessionAttributes.name;
            
            speakOutput = `${greeting} Welcome back to who said that ${name}! I can give you a warm up question, take you to round one,
             or for help, say help me, which would you like?`;
        }
        //apla
            
            let responseBuilder = handlerInput.responseBuilder
            responseBuilder
            .addDirective({
            type: "Alexa.Presentation.APLA.RenderDocument",
            token: AUDIO_TOKEN,
            document: audioDocument,
            datasources: {
                "soundsource": introsound,
                "speechsource": speakOutput
                }
            });
        

        // increment the number of visits and save the session attributes so the
        // ResponseInterceptor will save it persistently.
        sessionAttributes.visits += 1;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
        speakOutput = '';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const BeginGameHandler = {
    canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
        && handlerInput.attributesManager.getSessionAttributes().questionAsked === 'PlayGameOrNot';
},
 handle(handlerInput) {
        const speakOutput = 'Awesome, lets get ready to play, first can you tell me your name, say my name is followed by your first name?';
        const speakReprompt = 'Please say, my name is, followed by your name';
        setQuestion(handlerInput, null);
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakReprompt)
            .getResponse();
    }
};

const DontBeginGameHandler = {
    canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent'
        && handlerInput.attributesManager.getSessionAttributes().questionAsked === 'PlayGameOrNot';
},
 handle(handlerInput) {
        
        const speakOutput = 'No worries, come back anytime you would like to play who said that, goodbye';
        //end session
        setQuestion(handlerInput, null);
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //comment out reprompt to end skill after speakOutput
            // .reprompt(speakOutput);
            .getResponse();

    }
};

// Now get users name

const GetNameHandler = {
    canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetNameIntent'
    },
    handle(handlerInput){
        const name = Alexa.getSlotValue(handlerInput.requestEnvelope, 'name');
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.name = name;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        let speakOutput = `Nice to meet you ${name}, I can start you off with a warmup question or take you to round one, which would you like?`;
        
        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
};

//warm up questions
const WarmupQuestionsHandler = {
    //WarmupQuestionsIntent
    canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'WarmupQuestionsIntent'
    },
    handle(handlerInput){
        
    // get the current session attributes, creating an object you can read/update
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    
    //set questionType so guessAuthorHandler can separate from round one question
     setQuestionType(handlerInput, 'WarmupType');
    
    
    
    
     //Import the celebrity functions and get a random celebrity.
    const wfunctions = require('./warmupFunctions.js');
    const warmupQuote = wfunctions.getRandomWarmupQuestion();
    
    let speakOutput = '';
    
    //set the "current_celeb" attribute
            sessionAttributes.current_quote = warmupQuote.quote;
            sessionAttributes.current_author = warmupQuote.correctauthor;
            sessionAttributes.current_optionone = warmupQuote.optionone;
            sessionAttributes.current_optiontwo = warmupQuote.optiontwo;
            sessionAttributes.correct_name = warmupQuote.firstname;
            

            //save the session attributes
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            //randomize the order of authors so it does not become mundane
            const PotentialSpeech = [`here is your warm up question, who said the following quote, ${warmupQuote.quote}, was it ${warmupQuote.optiontwo}, ${warmupQuote.correctauthor}, or ${warmupQuote.optionone}, please say it was, followed by their first name`,
            `${warmupQuote.quote}, who said that, was it ${warmupQuote.correctauthor}, ${warmupQuote.optiontwo}, or ${warmupQuote.optionone}, please say it was, followed by their first name`,`${warmupQuote.quote}, who said that, was it ${warmupQuote.optiontwo}, ${warmupQuote.optionone}, or ${warmupQuote.correctauthor}, please say it was, followed by their first name`, `here is your warm up question, can you guess who said, ${warmupQuote.quote}, was it ${warmupQuote.optiontwo}, ${warmupQuote.optionone}, or ${warmupQuote.correctauthor}, please say it was, followed by their first name`];

            //Ask the question
            speakOutput = PotentialSpeech[Math.floor(Math.random() * PotentialSpeech.length)];
    
    return handlerInput.responseBuilder
    .speak(speakOutput)
    .reprompt('please say, it was, followed by your guess of the authors first name')
    .getResponse();
    }
    
};

//Round One Intent
const RoundOneHandler = {
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RoundOneIntent'
    },
    handle(handlerInput){
    //set questionType so guessAuthorHandler can separate from round one question
    setQuestionType(handlerInput, 'RoundOneType');
        
    // get the current session attributes, creating an object you can read/update
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    
    //initiliaze a speakOutput for the responseBuilder 
    let speakOutput = '';
    
     //Import the celebrity functions and get a random celebrity.
    const rofunctions = require('./RoundoneFunctions.js');
    const roundOneQuote = rofunctions.getRandomRoundoneQuestion(sessionAttributes.past_quotes);
    
    // Check to see if there are any quotes left.
        if (roundOneQuote.id === 0) {
            speakOutput = `You have run out of quotes. Check back each month for new quotes to be added to this skill`;
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
        } else {
           
    
            //set the "current_quote" attribute
            sessionAttributes.quoteobject = roundOneQuote;
            sessionAttributes.current_quote = roundOneQuote.quote;
            sessionAttributes.current_author = roundOneQuote.correctauthor;
            sessionAttributes.current_optionone = roundOneQuote.optionone;
            sessionAttributes.current_optiontwo = roundOneQuote.optiontwo;
            sessionAttributes.correct_name = roundOneQuote.firstname;
            
            //WINNER OR LOSER--------------------------------------------------------------------------------------------------------------------------------------------------
            //if the user gets 10 correct or 10 incorrect end session
            if(sessionAttributes.roundone_correct === 10){
            sessionAttributes.roundone_correct = 0;
            sessionAttributes.roundone_incorrect = 0;
            
            speakOutput = 'you have won round one after correctly guessing the author of 10 quotes, you can say round one to play again with new quotes, ask to play the all new presidential round or say stop to end this session'
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('you can say round one to play again, say play presidential round or say stop to end this session')
            .getResponse();
            } else if(sessionAttributes.roundone_incorrect === 10){
            sessionAttributes.roundone_correct = 0;
            sessionAttributes.roundone_incorrect = 0;
            speakOutput = 'you have lost round one after incorrectly guessing the author of 10 quotes, you can say round one to play again with new quotes or say stop to end this session, which would you like?'
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('you can say round one to play again or end this session')
            .getResponse();
            }
            //--------------------------------------------------------------------------------------------------------------------------------------------------------------------
                

            //save the session attributes
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            //randomize the order of authors so it does not become mundane
            const PotentialSpeech = [`here is your round one question, who said the following quote, ${roundOneQuote.quote}, was it ${roundOneQuote.optiontwo}, ${roundOneQuote.correctauthor}, or ${roundOneQuote.optionone}, please say it was, followed by their first name`,
            `${roundOneQuote.quote}, who said that, was it ${roundOneQuote.correctauthor}, ${roundOneQuote.optiontwo}, or ${roundOneQuote.optionone}, please say it was, followed by their first name`, `can you guess who said, ${roundOneQuote.quote}, was it ${roundOneQuote.optiontwo}, ${roundOneQuote.optionone}, or ${roundOneQuote.correctauthor}, please say it was, followed by their first name`, `${roundOneQuote.quote}, who said that, was it ${roundOneQuote.optiontwo}, ${roundOneQuote.optionone}, or ${roundOneQuote.correctauthor}, please say it was, followed by their first name`];

            //Ask the question
            speakOutput = PotentialSpeech[Math.floor(Math.random() * PotentialSpeech.length)];
    
    return handlerInput.responseBuilder
    .speak(speakOutput)
    .reprompt('please say, it was, followed by your guess of the authors first name')
    .getResponse();
        }
    }
};


const GuessAuthorHandler = {
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GuessAuthorIntent'
    },
    handle(handlerInput){
        let speakOutput = '';
       
         // get the current session attributes, creating an object you can read/update
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // if the current_quote is null, error, cue them to say "yes" and end
        if (sessionAttributes.current_author === null)
        {
            speakOutput =
                "I'm sorry, there's no active question right now. I can give you a warmup question or start round one, which would you like?";
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
        
        //initialize variable to record user answer
        var authorguess;
        
        
         // WARM UP QUESTION-------------------------------------------------------------------------------------------------------------------WARM UP---------------
        if(sessionAttributes.questionType === 'WarmupType'){
        
        //retrieve users guess/answer
        authorguess = handlerInput.requestEnvelope.request.intent.slots.author.value;
        
        //Okay, check the answer
        const wfunctions = require('./warmupFunctions.js');
        let winner = wfunctions.checkAnswer(
            sessionAttributes.correct_name,
           authorguess
        );
        //nullify questionType
        setQuestionType(handlerInput, null);


         //store current author in variable
         //empty current_author, current quote, and the two options to make space for next author
        let cname = sessionAttributes.current_author;
        const cquote = sessionAttributes.current_quote;
        const correctFirstName = sessionAttributes.correct_name;
        sessionAttributes.current_author = null;
        sessionAttributes.current_optiontwo = null;
        sessionAttributes.current_optionone = null;
        sessionAttributes.current_quote = null;
        sessionAttributes.correct_name = null;


        //Did they get it?
        if (winner) {
            speakOutput = `<amazon:emotion name="excited" intensity="high">
                                Correct! the author is ${cname}, I can provide you with another warmup question or take you to round one, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
        } else {
            speakOutput = `<amazon:emotion name="disappointed" intensity="medium">
                                Oh no, your guess was incorrect, I can provide you with another warmup question or take you to round one, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
        }

        
               //store all the updated session data
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
            // //apla
            responseBuilder = handlerInput.responseBuilder;
            responseBuilder
            .addDirective({
            type: "Alexa.Presentation.APLA.RenderDocument",
            token: winner ? AUDIO_TOKEN : SEQUENCE_TOKEN,
            document: winner ? audioDocument : sequenceDocument,
            datasources: {
                "soundsource": winner ? correctsound : incorrectsound,
                "speechsource": speakOutput
                }
            });
        
        // speakOutput = '';
        
        return handlerInput.responseBuilder
        // .speak(speakOutput)
        .reprompt('I can provide you with another warmup question or take you to round one, which would you like?')
        .getResponse();
        } 
        // ------------------------------------------ROUND ONE ----------------------------------------------------------------------------ROUND ONE----------------------
        else if(sessionAttributes.questionType === 'RoundOneType') {
        //retrieve users guess/answer
        authorguess = handlerInput.requestEnvelope.request.intent.slots.author.value;
        
         //nullify questionType
        setQuestionType(handlerInput, null);
    
        
        //Okay, check the answer
        const rofunctions = require('./RoundoneFunctions.js');
        let winner = rofunctions.checkAnswer(
            sessionAttributes.correct_name,
           authorguess
        );
       
        
         // Add the celebrity to the list of past celebs.
        // Store the value for the rest of the function,
        // and set the current celebrity to null
        sessionAttributes.past_quotes.push(sessionAttributes.quoteobject);

         //store current author in variable
         //empty current_author, current quote, and the two options to make space for next author
        let cname = sessionAttributes.current_author;
        const cquote = sessionAttributes.current_quote;
        const correctFirstName = sessionAttributes.correct_name;
        sessionAttributes.current_author = null;
        sessionAttributes.current_optiontwo = null;
        sessionAttributes.current_optionone = null;
        sessionAttributes.current_quote = null;
        sessionAttributes.correct_name = null;
        sessionAttributes.quoteobject = null;
        
        
        
        
         //Did they get it?
        if (winner) {
            sessionAttributes.roundone_correct += 1;
            speakOutput = `<amazon:emotion name="excited" intensity="high">
                                Correct! the author is ${cname}, you have now gotten ${sessionAttributes.roundone_correct} correct, I can give you another round one quote or say stop to end this session, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
                            
        } else {

            sessionAttributes.roundone_incorrect += 1;
            speakOutput = `<amazon:emotion name="disappointed" intensity="medium">
                                Oh no, your guess was incorrect,you have now gotten ${sessionAttributes.roundone_incorrect} incorrect, I can give you another round one quote or say stop to end this session, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
                            
        }
        
        //store all the updated session data
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
            // //apla
            responseBuilder = handlerInput.responseBuilder;
            responseBuilder
            .addDirective({
            type: "Alexa.Presentation.APLA.RenderDocument",
            token: winner ? AUDIO_TOKEN : SEQUENCE_TOKEN,
            document: winner ? audioDocument : sequenceDocument,
            datasources: {
                "soundsource": winner ? correctsound : incorrectsound,
                "speechsource": speakOutput
                }
            });
        
        //clear speak for apla to play and then prompt user
        // speakOutput = '';
  
         return handlerInput.responseBuilder
        // .speak(speakOutput)
        .reprompt('say next round one quote for another quote or you can say stop to end this session, which would you like?')
        .getResponse();

        }
        // --------------------------------------------------------------------------------------------PRESIDENTIAL ROUND ---------------------------------------------------------
        else if(sessionAttributes.questionType === 'PresidentialRoundType') {
           //retrieve users guess/answer
        authorguess = handlerInput.requestEnvelope.request.intent.slots.author.value;
        
         //nullify questionType
        setQuestionType(handlerInput, null);
    
        
        //Okay, check the answer
        const presidentialfunctions = require('./PresidentialRoundFunctions.js');
        let winner = presidentialfunctions.checkAnswer(
            sessionAttributes.correct_name,
           authorguess
        );
       
        
         // Add the president to the list of past presidents.
        // Store the value for the rest of the function,
        // and set the current president to null
        sessionAttributes.pastpresidential_quotes.push(sessionAttributes.quoteobject);

         //store current author in variable
         //empty current_author, current quote, and the two options to make space for next author
        let pname = sessionAttributes.current_author;
        let pquote = sessionAttributes.current_quote;
        // let correctFirstName = sessionAttributes.correct_name;
        sessionAttributes.current_author = null;
        sessionAttributes.current_optiontwo = null;
        sessionAttributes.current_optionone = null;
        sessionAttributes.current_quote = null;
        sessionAttributes.correct_name = null;
        sessionAttributes.quoteobject = null;
        
        
        
        
         //Did they get it?
        if (winner) {
            sessionAttributes.presidential_correct += 1;
            speakOutput = `<amazon:emotion name="excited" intensity="high">
                                Correct! the author is ${pname}, you have now gotten ${sessionAttributes.presidential_correct} correct, say next president quote for the next question or say stop to end this session, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
                            
        } else {

            sessionAttributes.presidential_incorrect += 1;
            speakOutput = `<amazon:emotion name="disappointed" intensity="medium">
                                Oh no, your guess was incorrect,you have now gotten ${sessionAttributes.presidential_incorrect} incorrect, say next president quote for the next question or say stop to end this session, which would you like?
                            </amazon:emotion>
                            <break strength="medium"/>`;
                            
        }
        
        //store all the updated session data
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
            // //apla
            responseBuilder = handlerInput.responseBuilder;
            responseBuilder
            .addDirective({
            type: "Alexa.Presentation.APLA.RenderDocument",
            token: winner ? AUDIO_TOKEN : SEQUENCE_TOKEN,
            document: winner ? audioDocument : sequenceDocument,
            datasources: {
                "soundsource": winner ? correctsound : incorrectsound,
                "speechsource": speakOutput
                }
            });
        
        //clear speak for apla to play and then prompt user
        // speakOutput = '';
  
         return handlerInput.responseBuilder
        // .speak(speakOutput)
        .reprompt('Say next presidential quote for the next question or say stop to end this session, which would you like?')
        .getResponse();

        }

        
    }
};


const PresidentialRoundHandler = {
    canHandle(handlerInput){
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PresidentialRoundIntent';
    },
    handle(handlerInput){
        let speakOutput;
       
        //set questionType so guessAuthorHandler can separate from round one and warm up question
        setQuestionType(handlerInput, 'PresidentialRoundType');
        
        // get the current session attributes, creating an object you can read/update
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
         //Import the presidential round functions and get a random president quote.
        const presidentialfunctions = require('./PresidentialRoundFunctions.js');
        const PresidentialQuote = presidentialfunctions.getRandomPresidentialQuestion(sessionAttributes.pastpresidential_quotes);
    
    // Check to see if there are any quotes left.
        if (PresidentialQuote.id === 0) {
            speakOutput = `You have run out of presidential quotes. Check back each month for ten new quotes to be added to this skill`;
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
        } else {
           
    
            //set the "current_quote" attribute
            sessionAttributes.quoteobject = PresidentialQuote;
            sessionAttributes.current_quote = PresidentialQuote.quote;
            sessionAttributes.current_author = PresidentialQuote.correctauthor;
            sessionAttributes.current_optionone = PresidentialQuote.optionone;
            sessionAttributes.current_optiontwo = PresidentialQuote.optiontwo;
            sessionAttributes.correct_name = PresidentialQuote.firstname;
            
            
             if(sessionAttributes.presidential_correct === 10){
                    sessionAttributes.presidential_correct = 0;
                    sessionAttributes.presidential_incorrect = 0;
                    speakOutput = 'you have won the presidential round after correctly guessing the author of 10 quotes, you can ask for a warm up question, say round one to play round one with new random quotes, say presidential round with new quotes or say stop to end this session, which would you like?'
                    return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt('you can say presidential round to play again or end this session')
                    .getResponse();
             } else if(sessionAttributes.presidential_incorrect === 10){
                    sessionAttributes.presidential_correct = 0;
                    sessionAttributes.presidential_incorrect = 0;
                    speakOutput = 'you have lost round one after incorrectly guessing the author of 10 quotes, you can say presidential quotes to play again with new random quotes from presidents or say stop to end this session, which would you like?'
                    return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt('you can say presidential round to play again or end this session')
                    .getResponse();
             }
          
            
            
            
    
         //save the session attributes
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            //randomize the order of authors so it does not become mundane
            const PotentialSpeech = [`which president said the following quote, ${PresidentialQuote.quote}, was it ${PresidentialQuote.optiontwo}, ${PresidentialQuote.correctauthor}, or ${PresidentialQuote.optionone}, please say it was, followed by their first name`,
            `${PresidentialQuote.quote}, which president said that, was it ${PresidentialQuote.correctauthor}, ${PresidentialQuote.optiontwo}, or ${PresidentialQuote.optionone}, please say it was, followed by their first name`, `can you guess who said, ${PresidentialQuote.quote}, was it ${PresidentialQuote.optiontwo}, ${PresidentialQuote.optionone}, or ${PresidentialQuote.correctauthor}, please say it was, followed by their first name`, `${PresidentialQuote.quote}, who said that, was it ${PresidentialQuote.optiontwo}, ${PresidentialQuote.optionone}, or ${PresidentialQuote.correctauthor}, please say it was, followed by their first name`];

            //Ask the question
            speakOutput = PotentialSpeech[Math.floor(Math.random() * PotentialSpeech.length)];
    
    return handlerInput.responseBuilder
    .speak(speakOutput)
    .reprompt('please say, it was, followed by your guess of the presidents first name')
    .getResponse();
        
        }
    }
}


// -----------------------------------------------------------------------------Built-in below ------------------------------------------

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'who said that is a game which gives you random quotes and ask you to guess the authors first name only, you can ask for warmup questions or to be taken to round one';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let speakOutput = 'Thanks for stopping by who said that, hope to see you back soon! Goodbye!';
        
        if(sessionAttributes.name !== null){
            let name = sessionAttributes.name;
            speakOutput = `Thanks for stopping by who said that ${name}, hope to see you back soon! Goodbye!`;
        }
        
             //apla
            responseBuilder = handlerInput.responseBuilder
            responseBuilder
            .addDirective({
            type: "Alexa.Presentation.APLA.RenderDocument",
            token: AUDIO_TOKEN,
            document: audioDocument,
            datasources: {
                "soundsource": outrosound,
                "speechsource": speakOutput
                }
            });
            
            speakOutput = '';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const LoadDataInterceptor = {
    async process(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // get persistent attributes, using await to ensure the data has been returned before
        // continuing execution
        var persistent = await handlerInput.attributesManager.getPersistentAttributes();
        if(!persistent) persistent = {};

        // ensure important variables are initialized so they're used more easily in handlers.
        // This makes sure they're ready to go and makes the handler code a little more readable
        if(!sessionAttributes.hasOwnProperty('quoteobject')) sessionAttributes.quoteobject = null;
        if(!sessionAttributes.hasOwnProperty('current_quote')) sessionAttributes.current_quote = null;
        if(!sessionAttributes.hasOwnProperty('current_author')) sessionAttributes.current_author = null;
        if(!sessionAttributes.hasOwnProperty('current_optionone')) sessionAttributes.current_optionone = null;
        if(!sessionAttributes.hasOwnProperty('current_optiontwo')) sessionAttributes.current_optiontwo = null;
        if(!sessionAttributes.hasOwnProperty('correct_name')) sessionAttributes.correct_name = null; 
        if(!sessionAttributes.hasOwnProperty('roundone_correct')) sessionAttributes.roundone_correct = 0;
        if(!sessionAttributes.hasOwnProperty('roundone_incorrect')) sessionAttributes.roundone_incorrect = 0;
        if(!sessionAttributes.hasOwnProperty('presidential_correct')) sessionAttributes.presidential_correct = 0;
        if(!sessionAttributes.hasOwnProperty('presidential_incorrect')) sessionAttributes.presidential_incorrect = 0;
        if(!persistent.hasOwnProperty('past_quotes')) persistent.past_quotes = [];  
        if(!sessionAttributes.hasOwnProperty('past_quotes')) sessionAttributes.past_quotes = [];
        if(!sessionAttributes.hasOwnProperty('pastpresidential_quotes')) sessionAttributes.pastpresidential_quotes = [];
        
        // set the visits value (either 0 for new, or the persistent value)
         sessionAttributes.visits = (persistent.hasOwnProperty('visits')) ? persistent.visits : 0;
        
        //set the session attributes so they're available to your handlers
        sessionAttributes.name = (persistent.hasOwnProperty('name')) ? persistent.name : null;
        sessionAttributes.past_quotes = (quotes_tracking) ? persistent.past_quotes : sessionAttributes.past_quotes;
        sessionAttributes.past_quotes = (quotes_tracking) ? persistent.pastpresidential_quotes : sessionAttributes.pastpresidential_quotes;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    }
};
// This request interceptor will log all incoming requests of this lambda
const LoggingRequestInterceptor = {
    process(handlerInput) {
        console.log('----- REQUEST -----');
        console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
    }
};


// Response Interceptors run after all skill handlers complete, before the response is
// sent to the Alexa servers.
const SaveDataInterceptor = {
    async process(handlerInput) {
        const persistent = {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // save (or not) the past_quotes & visits
        persistent.past_quotes = (quotes_tracking) ? sessionAttributes.past_quotes : [];
        persistent.pastpresidential_quotes = (quotes_tracking) ? sessionAttributes.pastpresidential_quotes : [];
        persistent.visits = sessionAttributes.visits;
        persistent.name = sessionAttributes.name;
        // set and then save the persistent attributes
        handlerInput.attributesManager.setPersistentAttributes(persistent);
        let waiter = await handlerInput.attributesManager.savePersistentAttributes();
    }
};
// This response interceptor will log all outgoing responses of this lambda
const LoggingResponseInterceptor = {
    process(handlerInput, response) {
        console.log('----- RESPONSE -----');
        console.log(JSON.stringify(response, null, 2));
    }
};


/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        BeginGameHandler,
        DontBeginGameHandler,
        GetNameHandler,
        WarmupQuestionsHandler,
        RoundOneHandler,
        GuessAuthorHandler,
        PresidentialRoundHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
        .addRequestInterceptors(
        LoadDataInterceptor,
        LoggingRequestInterceptor
    )
         .addResponseInterceptors(
        SaveDataInterceptor,
        LoggingResponseInterceptor
    )
    .addErrorHandlers(
        ErrorHandler)
         .withPersistenceAdapter(
        new ddbAdapter.DynamoDbPersistenceAdapter({
            tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
            createTable: false,
            dynamoDBClient: new AWS.DynamoDB({apiVersion: 'latest', region: process.env.DYNAMODB_PERSISTENCE_REGION})
        })
    )
    .withCustomUserAgent('sample/hello-world/v1.2')
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();