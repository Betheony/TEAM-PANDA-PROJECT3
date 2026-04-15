
/* This is the component that handles translations. */
/* Right now it's just a proof-of-concept. It only takes in an input. I need to expand it to work with the entire webpage. -Ben */

/* ON DEPLOYMENT, CHANGE THE URL TO THE ACTUAL WEBSITE URL!!! */

"use client";
import { useState } from "react";

// THIS NEEDS TO BE CHANGED ON DEPLOYMENT!!!
let api_url = "http://localhost:3000/api/translate" 

// Function to trigger a Google Translate API call.
// Asynchronous so that the website can continue to run while it makes the call.
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
        if (!res.ok) {

            console.error(data);
            throw new Error("Translation failed...");
        }

        console.log(data.translatedText ?? "");
    } 

    // Error handling...
    catch (error) {

        console.error(error);
    } 

}