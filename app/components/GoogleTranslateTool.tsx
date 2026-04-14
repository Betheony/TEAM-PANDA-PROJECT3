
/* This is the component that handles translations. */
/* Right now it's just a proof-of-concept. It only takes in an input. I need to expand it to work with the entire webpage. -Ben */

"use client";
import { useState } from "react";

export default function Translator() {

    // States are required because updating them triggers a re-render.
    // These states handle the text input, translation, and whether the data is received.
    const [text, setText] = useState("");
    const [translatedText, setTranslatedText] = useState("");

    // Function to trigger a Google Translate API call.
    // Asynchronous so that the website can continue to run while it makes the call.
    async function handleTranslate() {

        // POST request to Google Translate.
        // Ensure that the API key is locally set!
        try {

            const res = await fetch("/api/translate", {

                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    target: "es",
                }),
            });

            // Wait for the response...
            const data = await res.json();

            // Alert if the translation failed for whatever reason.
            if (!res.ok) {
                console.error(data);
                alert("Translation failed");
                setTranslatedText("");
                return;
            }

            // Set the Translated Text to the received data. If nothing was received, set it to a blank.
            setTranslatedText(data.translatedText ?? "");

        } 

        // Error handling...
        catch (error) {

            console.error(error);
            alert("Translation failed");
            setTranslatedText("");
        } 

    }

    // Simple widget for translating text. It's a proof-of-concept.
    return (
        <div className="bg-black space-y-4">
            <textarea
                className="border p-2 w-full"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text"
            />
            <button
                className="border px-4 py-2"
                onClick={handleTranslate}
            >
                Click me to translate!!
            </button>
            <div className="border p-2 min-h-20">{translatedText}</div>
        </div>
    );
}