# JustDump Chrome Extension Setup Instructions

## 1. Get a Gemini API Key

1.  Go to the Google AI Studio website: [https://aistudio.google.com/](https://aistudio.google.com/)
2.  Sign in with your Google account.
3.  Click on the "Get API key" button.
4.  Copy the generated API key.

## 2. Add the API Key to the Extension

1.  Open the `background.js` file in the project directory.
2.  Find the line that says: `const apiKey = ""; // IMPORTANT: Add your Gemini API Key here`
3.  Paste your API key between the double quotes. For example: `const apiKey = "YOUR_API_KEY";`
4.  Save the `background.js` file.

## 3. Load the Extension in Chrome

1.  Open the Chrome browser and navigate to `chrome://extensions`.
2.  Enable "Developer mode" by clicking the toggle switch at the top right of the page.
3.  Click the "Load unpacked" button that appears on the top left.
4.  In the file selection dialog, navigate to the project directory (`my-place-pro`) and click the "Select" button.
5.  The "JustDump" extension should now appear in your list of extensions.

## 4. How to Use

1.  Navigate to any webpage.
2.  To save an image or video, hover over it with your mouse, and a "Save to JustDump" button will appear. Click it to save.
3.  To save an article, press and hold the `Alt` key while hovering over the article's text. The "Save Article" button will appear. Click it to save.
4.  To view your saved content, click on the JustDump extension icon in the Chrome toolbar and click the "Boards" button, or right-click the extension icon and select "Options".

Enjoy using JustDump!
