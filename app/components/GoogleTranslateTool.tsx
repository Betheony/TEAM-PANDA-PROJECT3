
/* This is the component that handles translations. */
/* Right now it's just a proof-of-concept. It only takes in an input. I need to expand it to work with the entire webpage. -Ben */

/* ON DEPLOYMENT, CHANGE THE URL TO THE ACTUAL WEBSITE URL!!! */

"use client";
import React, { useEffect, useState } from "react";

// THIS NEEDS TO BE CHANGED ON DEPLOYMENT!!!
let api_url = "http://localhost:3000/api/translate" 

// Global variable (readable anywhere)
let do_translate = false;

// Getter
export function return_do_translate() {
  return do_translate;
}

// Simple button component that updates the variable for doing the translation.
export const TranslateButton = () => {

    // Use a React state to force a re-render.
    const [translate, setTranslate] = useState(false);

    // Function that triggers when a click is done.
    // Updates the transition boolean and forces a re-render.
    const handleClick = () => {

        const new_translation_bool = !translate;

        // Update React state (causes re-render)
        setTranslate( new_translation_bool );

        // Sync the global variable
        do_translate = new_translation_bool;
    };

  return (
    <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 
            rounded-full border border-boba-border bg-boba-surface 
            px-3 py-2 text-sm text-boba-primary transition-colors 
            hover:border-boba-accent hover:bg-boba-subtle"
        >
            {/* Use the value from the React State. */}
        {translate ? "Translate to English" : "Translate to Spanish"}
    </button>
  );
};

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