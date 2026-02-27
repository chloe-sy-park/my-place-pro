# JustDump User Guide

AI-powered knowledge archive Chrome extension.

---

## 1. Installation

### 1-1. Load as Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **"Load unpacked"** and select the JustDump project folder.
4. **"JustDump"** should appear in your extensions list.

### 1-2. Pin to Toolbar (Recommended)

1. Click the **puzzle piece icon** in the Chrome toolbar.
2. Click the **pin icon** next to JustDump.
3. The JustDump icon will now appear directly in your toolbar.

---

## 2. Settings

On first install, the **Settings page** opens automatically.

### 2-1. Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** and copy the generated key.
4. Paste the key into the **Gemini API Key** field on the Settings page.
5. Click **Save Settings**.

> **Without an API key**: Content will still be saved, but AI analysis (summary, category, tags, board recommendation) will be skipped.

### 2-2. Data Sync (Optional)

Toggle **"Help improve JustDump"** to anonymously share content categories and tags. No personal data, URLs, or content is sent.

### 2-3. Accessing Settings Later

- **From Dashboard**: Click **"Settings"** in the bottom of the sidebar.
- **From Chrome**: Right-click the JustDump icon > **"Options"**.

---

## 3. Saving Content

JustDump offers **two ways** to save content.

### Method 1: Pin Button (Images / Videos / Articles)

#### Images & Videos

1. Hover over any **image or video** (larger than 100px) on a webpage.
2. A purple **"Save to JustDump"** button appears.
3. Click it — the AI analyzes and saves the content automatically.
4. **"Saved!"** confirms the save is complete.

#### Articles (Body Text)

1. Hold the **`Alt` key** and hover over body text on a webpage.
2. A **"Save Article"** button appears.
3. Click to extract and save the page body (up to 1,500 characters).

### Method 2: Popup (Current Page)

1. Click the **JustDump icon** in the toolbar.
2. The current page title and URL are displayed.
3. For YouTube pages, a **thumbnail preview** appears automatically.
4. Select a **board** from the dropdown.
5. Optionally add a **note**.
6. Click **"Save This Page"**.
7. The popup closes automatically after saving.

> **Note**: Browser internal pages (`chrome://`, `about://`) cannot be saved.

---

## 4. Dashboard

### Opening the Dashboard

- **From Popup**: Click the **"Boards"** link in the top-right.
- **From Chrome**: Right-click the JustDump icon > **"Options"**, then navigate to the Dashboard.

### 4-1. Board Management

The sidebar on the left manages your boards.

- **Switch boards**: Click a board name to filter items.
- **Create a board**: Click **"+ New Board"** and enter a name.
- **Inbox**: The default board for items without a specific board assignment.

### 4-2. Item Details

Click any card in the grid to open the detail panel:

- **Category badge**: AI-assigned category
- **AI summary**: One-sentence content summary
- **Tags**: Up to 3 AI-generated tags
- **Original content**: Image, video, or text preview

### 4-3. Moving Items Between Boards

1. In the detail panel, click the **"Board:"** dropdown.
2. Select the target board.
3. The item moves immediately and the panel closes.

### 4-4. Deleting Items

1. Click **"Delete"** in the top-right of the detail panel.
2. Confirm the deletion in the dialog.

### 4-5. Threads

Add time-stamped notes to any saved item.

1. Scroll to the **"Threads"** section in the detail panel.
2. Type your note in the input field.
3. Click **"Add"** — the note appears with a timestamp.
4. Newest notes appear first.

### 4-6. Related Content

The **"Related Content"** section shows items with similar categories or tags. Click a recommendation to view its details.

---

## 5. AI Features

JustDump uses Google Gemini AI to automatically:

| Feature | Description |
|---------|-------------|
| **Summary** | One-sentence summary of the content |
| **Category** | Auto-classification (Tech, Design, News, etc.) |
| **Tags** | 3 relevant tags generated automatically |
| **Board recommendation** | Suggests the best matching board |

> **No API key?** Content is saved without AI analysis. The summary shows "AI analysis was skipped."

---

## 6. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save image/video | Hover → Click Pin button |
| Save article | `Alt` + text hover → Click Pin button |
| Save current page | Toolbar icon → Save This Page |
| Open dashboard | Popup > Boards / Right-click > Options |

---

## 7. Troubleshooting

### "This page cannot be saved"

Browser internal pages (`chrome://`, `about://`, `chrome-extension://`) do not support content extraction. Try a regular webpage.

### AI analysis not working

- Verify your API key is entered correctly in **Settings**.
- Check that the key is valid at [Google AI Studio](https://aistudio.google.com/).
- Open Chrome DevTools (F12) > Console to check for errors.

### Pin button doesn't appear

- Images smaller than 100px don't trigger the Pin button.
- For text saving, hold `Alt` **before** hovering.
- Verify the extension is enabled at `chrome://extensions`.

### Saved items don't appear in Dashboard

- Check the current board selection — try clicking **Inbox**.
- AI may have auto-assigned the item to a different board.
