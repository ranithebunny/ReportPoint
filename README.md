# GitHub Collaboration Guide

This guide explains how to collaborate on ReportPoint using Git and GitHub. Follow these steps whenever you need to make changes to the project.

## 1. Install the Required Tools

Before starting, make sure you have:

- Git — Tracks changes to the project.
- Visual Studio Code (VS Code) — Used to edit project files.
- GitHub account — Used to access the repository.

Download the tools from their official websites:

- Git: https://git-scm.com/downloads
- VS Code: https://code.visualstudio.com/
- GitHub: https://github.com/

To check whether Git is installed, open your terminal and run:

```bash
git --version
```

If a version number appears, Git is installed.

---

## 2. Clone the Repository

Cloning means downloading a copy of the GitHub repository to your computer.

### Step 1: Copy the repository URL

1. Open the ReportPoint repository on GitHub.
2. Click the green Code button.
3. Select HTTPS.
4. Copy the repository URL.

The URL should look like this:

```text
https://github.com/USERNAME/REPOSITORY.git
```

Use the actual URL of the ReportPoint repository.

### Step 2: Open the terminal

Navigate to the folder where you want to save the project.

For example:

```bash
cd Desktop
```

### Step 3: Clone the repository

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
```

Replace the example URL with the actual repository URL.

### Step 4: Enter the project folder

```bash
cd REPOSITORY
```

Replace `REPOSITORY` with the folder name created by Git.

### Step 5: Open the project in VS Code

```bash
code .
```

If the command doesn't work, open VS Code manually and select File → Open Folder, then choose the project folder.

> Note: You only need to clone the repository once per computer. For future updates, use `git pull`.

---

## 3. Understand the Basic Git Workflow

Whenever you work on ReportPoint, follow this general process:

1. Pull — Download the latest changes.
2. Branch — Create a separate branch for your task.
3. Code — Make changes to your assigned files.
4. Commit — Save a snapshot of your changes.
5. Push — Upload your branch to GitHub.
6. Pull Request (PR) — Request a review before merging your changes into `main`.

### Important Git Terms

| Term | Meaning |
| --- | --- |
| Repository | The project and its version history. |
| Clone | Download the repository to your computer. |
| Branch | An independent line of development for your changes. |
| Commit | A saved snapshot of your changes. |
| Push | Upload your commits to GitHub. |
| Pull | Download and integrate remote changes. |
| Pull Request (PR) | A request to review and merge changes into another branch. |
| Merge | Combine changes from different branches. |
| Conflict | A situation where Git cannot automatically combine changes. |

---

## 4. Get the Latest Changes

Before starting new work, update your local project.

First, make sure any existing changes are committed or safely stored.

Then run:

```bash
git switch main
git pull origin main
```

This switches to `main` and downloads the latest changes.

> Important: Avoid switching branches if you have uncommitted changes that might conflict with the destination branch.

---

## 5. Create Your Own Branch

Do not work directly on `main`. Each team member should create a separate branch for their work.

For example:

```bash
# Vinnie — Resident Interface
git switch -c feature/resident-interface

# Rania — Admin Interface
git switch -c feature/admin-interface
```

Use a descriptive branch name that matches your task.

### Recommended Branch Naming Convention

| Type of Work | Example |
| --- | --- |
| New feature | `feature/resident-interface` |
| Admin feature | `feature/admin-dashboard` |
| Bug fix | `fix/report-status-update` |
| Styling | `style/responsive-layout` |
| Documentation | `docs/update-readme` |

To check your current branch, run:

```bash
git branch
```

The branch marked with an asterisk (`*`) is your current branch.

---

## 6. Make Changes to Your Assigned Files

Open the project in VS Code and edit the files assigned to you.

### Vinnie — Resident Interface

Focus on the resident-facing pages and their related assets.

### Rania — Admin Interface and Backend

Focus on the admin dashboard, API endpoints, database-related code, and other assigned backend components.

### Collaboration Rules

- Avoid editing the same files simultaneously whenever possible.
- Communicate before changing shared files.
- Coordinate changes to shared CSS and JavaScript files.
- Preserve existing function names and return shapes in `admin/js/data.js` until API integration is ready.
- Never overwrite another person's work when pulling or merging changes.
- Never commit passwords, database credentials, API keys, or private `.env` files.

---

## 7. Check Your Changes

Before committing, check which files you've modified.

```bash
git status
```

To review changes in tracked files:

```bash
git diff
```

Make sure you haven't accidentally changed unrelated files or included sensitive information.

---

## 8. Commit Your Changes

A commit saves a snapshot of your work in Git.

### Step 1: Stage your changes

To stage all changes in the current directory and its subdirectories:

```bash
git add .
```

Alternatively, stage only a specific file:

```bash
git add path/to/file
```

### Step 2: Create a commit

```bash
git commit -m "Add resident report submission page"
```

Write a short message describing what you changed.

### Examples of Good Commit Messages

```bash
git commit -m "Add resident login page"
git commit -m "Style admin dashboard"
git commit -m "Add report status filters"
git commit -m "Fix mobile navigation layout"
git commit -m "Update project README"
```

Tip: Commit related changes together instead of grouping unrelated changes into one large commit.

---

## 9. Push Your Branch to GitHub

After committing your changes, upload your branch to GitHub.

For a new branch, run:

```bash
git push -u origin feature/resident-interface
```

Replace `feature/resident-interface` with your actual branch name.

The `-u` option connects your local branch to its remote counterpart. You generally only need it for the first push.

For subsequent pushes, run:

```bash
git push
```

Your branch and commits should now appear on GitHub.

> Remember: Pushing your branch does not automatically merge your changes into `main`.

---

## 10. Create a Pull Request (PR)

A Pull Request lets your teammate review your changes before they become part of the main project.

### Step 1: Open the repository on GitHub

After pushing your branch, open the ReportPoint repository.

GitHub may display a Compare & pull request button. Click it.

If the button doesn't appear:

1. Open the Pull requests tab.
2. Click New pull request.
3. Set the base branch to `main`.
4. Set the compare branch to your feature branch.

For example:

- base: `main`
- compare: `feature/resident-interface`

This means you are proposing to merge your feature branch into `main`.

### Step 2: Describe your changes

Give your PR a clear title and explain what you changed.

Example:

```md
## Changes
- Added the resident report submission page.
- Updated the form layout and styling.
- Added client-side validation.

## Testing
- Checked the page in the browser.
- Tested the form with valid and invalid inputs.

## Notes
- Backend integration is not included yet.
```

Only include details that accurately describe your work.

### Step 3: Submit the PR

Click Create pull request.

Your teammate can now review your changes and leave comments.

### Step 4: Address review comments

If changes are requested:

1. Return to your existing feature branch.
2. Make the necessary edits.
3. Commit the changes.
4. Push the branch again.

For example:

```bash
git add .
git commit -m "Address review comments"
git push
```

The new commits will automatically appear in the same PR. You generally don’t need to create another PR.

### Step 5: Merge the PR

Once the changes are reviewed and approved, merge the PR into `main` according to your team’s agreed process.

Do not delete your branch until you’re sure the changes have been merged and you no longer need the branch.

---

## 11. Get Updates After Your Teammate Merges Changes

Suppose Vinnie merges the resident interface into `main`, and you want those changes on your computer.

First, commit or safely store any work you’re currently doing.

Then run:

```bash
git switch main
git pull origin main
```

Your local `main` branch will now contain the changes merged into the remote `main` branch.

### Update Your Feature Branch

If you’re still working on your own feature branch, you can bring the latest changes from `main` into it.

```bash
git fetch origin
git switch feature/admin-interface
git merge origin/main
```

Replace `feature/admin-interface` with your actual branch name.

This merges the latest remote `main` changes into your feature branch.

If Git reports conflicts, resolve them before continuing.

---

## 12. Common Git Commands

| Command | Purpose |
| --- | --- |
| `git status` | Check your current branch and changes. |
| `git branch` | List local branches. |
| `git switch main` | Switch to the main branch. |
| `git pull origin main` | Download and integrate changes from remote main. |
| `git switch -c feature/my-feature` | Create and switch to a new branch. |
| `git add .` | Stage changes in the current directory and its subdirectories. |
| `git diff` | Review unstaged changes to tracked files. |
| `git commit -m "Your message"` | Create a commit. |
| `git push -u origin feature/my-feature` | Push a new branch and set its upstream. |
| `git push` | Push commits to the configured remote branch. |
| `git fetch origin` | Download remote updates without integrating them into your current branch. |
| `git merge origin/main` | Merge remote main into your current branch. |
| `git log --oneline -5` | View the five most recent commits. |

---

## 13. Common Problems and Solutions

### Problem A: `git push` is rejected

This can happen when the remote branch contains changes that your local branch doesn’t have.

Check your current state:

```bash
git status
git fetch origin
```

Read the error message and determine whether you need to merge or rebase the remote changes.

> Avoid using `git push --force` as a quick fix. It can overwrite remote history and interfere with your teammate’s work.

### Problem B: I don’t know which branch I’m on

Run:

```bash
git status
```

The output identifies your current branch and indicates whether you have uncommitted changes.

### Problem C: I edited the wrong branch

Don’t panic or immediately reset your changes.

Check your current state:

```bash
git status
```

If you haven’t committed anything, safely store your changes before switching branches. If you’re unsure how to transfer the changes, ask your teammate for help.

### Problem D: Git reports a merge conflict

A conflict happens when Git cannot automatically combine competing changes.

1. Run `git status` to identify the affected files.
2. Open those files in VS Code.
3. Find the conflict markers.
4. Decide which changes to keep and combine the correct code.
5. Remove the conflict markers.
6. Test the affected files.
7. Stage the resolved files.
8. Complete the merge or rebase according to the operation Git started.

Conflict markers look like this:

```text
<<<<<<< HEAD
Your current changes
=======
Incoming changes
>>>>>>> origin/main
```

These are examples. Never leave conflict markers in the final source code.

If you’re unsure which changes to keep, ask your teammate before resolving the conflict.

### Problem E: I accidentally staged a file

To unstage a file without deleting your changes:

```bash
git restore --staged path/to/file
```

Replace the example path with the actual file path.

### Problem F: I want to check my recent commits

Run:

```bash
git log --oneline -5
```

This displays your five most recent commits.

---

## 14. Recommended Workflow for ReportPoint

Follow this process for each feature.

### Before Coding

```bash
git switch main
git pull origin main
git switch -c feature/my-feature
```

Replace `feature/my-feature` with a descriptive branch name.

### After Coding

```bash
git status
git diff
git add .
git commit -m "Describe your changes"
git push -u origin feature/my-feature
```

If you’ve already pushed this branch before, use `git push` instead of the first-push command.

### On GitHub

1. Open the repository.
2. Create a PR from your feature branch into `main`.
3. Describe your changes and testing.
4. Ask your teammate to review the PR.
5. Address feedback if needed.
6. Merge the PR once it meets the team’s agreed requirements.

### After the PR Is Merged

```bash
git switch main
git pull origin main
```

Repeat this workflow for each new feature.

---

## 15. Team Rules

To keep ReportPoint organized:

1. Do not commit directly to `main` for regular feature development.
2. Create a separate branch for each feature or task.
3. Pull the latest changes before starting new work.
4. Use clear, descriptive commit messages.
5. Push your branch when you’re ready to share your work.
6. Open a PR so your teammate can review your changes.
7. Communicate before modifying shared files.
8. Test your changes before requesting a review.
9. Never commit passwords, database credentials, private keys, or `.env` files.
10. Avoid destructive Git commands unless you understand their effects and have confirmed your work is safe.

Goal: Keep `main` as the shared, stable version of ReportPoint while each team member develops and tests features on their own branch.
