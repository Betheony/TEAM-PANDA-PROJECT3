
/* This is the component that handles translations. */
/* Right now it's just a proof-of-concept. It only takes in an input. I need to expand it to work with the entire webpage. -Ben */

/* ON DEPLOYMENT, CHANGE THE URL TO THE ACTUAL WEBSITE URL!!! */

"use client";

// THIS NEEDS TO BE CHANGED ON DEPLOYMENT!!!
let api_url = "http://localhost:3000/api/translate" 


// Function to trigger a Google Translate API call.
// Asynchronous so that the website can continue to run while it makes the call
/**
 * @param {string} text_to_translate This is the text to send to Google Translate.
 */
export async function translate_text(text_to_translate) {

    // POST request to Google Translate.
    // Ensure that the API key is locally set!
    try {

        const res = await fetch(api_url, {

            method: "POST",
            headers: {

                "Content-Type": "application/json",
            },
            body: JSON.stringify({

                text: text_to_translate,
                target: "es",
            }),
        });

        // Wait for the response...
        const data = await res.json();

        // Alert if the translation failed for whatever reason.
        // Then, return an error message.
        if (!res.ok) {

            console.error(data);
            
            return "Could not translate the text.";
        }

        // Log the translated text for bug testing...
        console.log(data.translatedText ?? "");

        return data.translatedText ?? "Could not translate the text.";
    } 

    // Error handling...
    // Also return an error message.
    catch (error) {

        console.error(error);
        return "Could not translate the text.";
    } 
}

// Translation function that maps the website's text to display to either the English Text or Spanish Text.

/**
 * 
 * Function that maps text in a language struct to a struct that contains the data to display.
 * Also returns the boolean "doTranslation" for keeping track of what language is being displayed (English or Spanish)
 * Requires the translation variable, the language structs, and a state updater.
 * 
 * @param doTranslation Boolean variable that decides what language to translate to.
 * @param text_English The English text, stored in a JSON-like object.
 * @param text_Spanish The Spanish text, stored in a JSON-like object.
 * @param text_updater A State Updater function. 
 * @returns doTranslation
 */


/**
 * 
 * @param text_English 
 * @param text_Spanish 
 */
export async function translate_struct_text( text_English: any, text_Spanish: any ) {

    // Iterate through the various website texts and then use them to populate the Spanish struct.
    for (const key in text_English) {
    
        console.log(key, text_English[key]);
        const translated = await translate_text(text_English[key]);
        console.log(translated);

        if (translated) {

            text_Spanish[key] = translated;
        }
    }
}