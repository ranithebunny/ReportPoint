# ReportPoint — College Point Citizen Reporting Website

| Part | Owner |
|---|---|
| Resident interface (`/resident`) | Vinnie |
| Admin interface (`/admin`) and backend/database (`/api`, `/database`) | Rania |


⸻

# GitHub Collaboration Guide

This guide explains how to work on ReportPoint using Git and GitHub. Follow these steps whenever you need to make changes to the project.

1. Install the Required Tools

Before starting, make sure you have:

* Git — Used to track changes and upload your work to GitHub.
* Visual Studio Code (VS Code) — Used to edit the project’s files.
* GitHub account — Used to access the repository.

Download the tools from their official websites:

* Git: https://git-scm.com/downloads
* VS Code: https://code.visualstudio.com/
* GitHub: https://github.com/

If Git is already installed, you can skip the installation step.

To check whether Git is installed, open your terminal and run:

git --version

If a version number appears, Git is installed.

2. Clone the Repository

Cloning means downloading a copy of the GitHub repository to your computer.

Step 1: Open the GitHub repository

Go to the ReportPoint repository on GitHub.

Click the green Code button, select HTTPS, and copy the repository URL.

It should look something like this:

https://github.com/USERNAME/REPOSITORY.git

Replace this example with the actual URL of the ReportPoint repository.

Step 2: Open your terminal

Open Terminal on Mac or Git Bash on Windows.

Navigate to the folder where you want to store the project.

For example:

cd Desktop

Step 3: Clone the repository

Run:

git clone https://github.com/USERNAME/REPOSITORY.git

Replace the example URL with the actual repository URL.

Step 4: Enter the project folder

cd REPOSITORY

Replace REPOSITORY with the actual folder name created by Git.

Step 5: Open the project in VS Code

Run:

code .

If the code command is unavailable, open VS Code manually and select File → Open Folder, then choose the cloned project folder.

You only need to clone the repository once per computer. After that, use git pull to download updates.

⸻

3. Understand the Basic Git Workflow

Whenever you work on the project, you’ll generally follow these steps:

1. Pull — Download the latest changes.
2. Branch — Create your own branch to work on a feature.
3. Edit — Make changes to your files.
4. Commit — Save a snapshot of your changes.
5. Push — Upload your branch to GitHub.
6. Pull Request (PR) — Ask for your changes to be reviewed and merged into the main branch.

Important Git Terms

Term	Meaning
Repository (repo)	The project and its version history.
Clone	Download the repository to your computer.
Branch	An independent line of development where you can make changes without directly modifying main.
Commit	A saved snapshot of your changes.
Push	Upload your local commits to GitHub.
Pull	Download and integrate changes from the remote repository.
Pull Request (PR)	A request to review and merge your branch into another branch.
Merge	Combine changes from one branch into another.
Conflict	A situation where Git cannot automatically reconcile competing changes.

⸻

4. Before Starting Work: Get the Latest Changes

Before editing anything, make sure your local project is updated.

Open your terminal inside the project folder and run:

git switch main
git pull origin main

This switches to the main branch and downloads its latest changes.

Important: Commit or safely store any existing work before switching branches. Git may prevent you from switching if your uncommitted changes conflict with the destination branch.

If you have uncommitted changes, save them on your current branch or commit them before proceeding.

⸻

5. Create Your Own Branch

Do not work directly on main. Each team member should create a separate branch for their changes.

For example, Vinnie can create a branch for the resident interface:

git switch -c feature/resident-interface

Rania can create a branch for the admin interface:

git switch -c feature/admin-interface

Use the appropriate branch name for your task.

Recommended Branch Naming Convention

Type of Work	Example
New feature	feature/resident-interface
Admin feature	feature/admin-dashboard
Bug fix	fix/report-status-update
Styling	style/resident-responsive-layout
Documentation	docs/update-readme

Each branch should focus on one feature or related set of changes.

To see which branch you’re currently using, run:

git branch

The branch with an asterisk (*) is your current branch.

⸻

6. Make Changes to Your Assigned Files

Open the project in VS Code and edit the files assigned to you.

Vinnie — Resident Interface

Focus on the resident-facing pages and their related assets.

Rania — Admin Interface and Backend

Focus on the admin dashboard, API endpoints, database-related code, and other assigned backend components.

Important Collaboration Rules

* Avoid editing the same files simultaneously whenever possible.
* Communicate before changing shared files.
* Coordinate changes to admin/css/theme.css because styling may affect multiple pages.
* Preserve existing function names and return shapes in admin/js/data.js until the API integration is ready.
* Do not overwrite another person’s work when pulling or merging changes.
* Never commit passwords, API keys, database credentials, or private .env files.
* Check with the team before modifying shared configurations or database structures.

Tip: Finish and test one logical feature before committing it.

⸻

7. Check Your Changes

Before committing, check which files you’ve changed.

Run:

git status

To see the actual changes in tracked files, run:

git diff

Make sure you haven’t accidentally changed unrelated files or included sensitive information.

⸻

8. Commit Your Changes

A commit records a snapshot of your work in Git.

Step 1: Stage your changes

To stage all your changes:

git add .

Alternatively, stage only a specific file:

git add path/to/your-file

Replace the example path with the actual file path.

Step 2: Create a commit

git commit -m "Add resident report submission page"

Write a short message describing what you changed.

Examples of Good Commit Messages

git commit -m "Add resident login page"
git commit -m "Style admin dashboard"
git commit -m "Add report status filters"
git commit -m "Fix mobile navigation layout"
git commit -m "Update project README"

Good practice: Commit related changes together instead of putting every unrelated change into one large commit.

If Git asks you to configure your identity, set your own name and email:

git config --global user.name "Your Name"
git config --global user.email "YOUR_GITHUB_EMAIL"

Use the name and email you want associated with your commits.

⸻

9. Push Your Branch to GitHub

After committing your changes, upload your branch to GitHub.

For a new branch, run:

git push -u origin feature/resident-interface

Replace feature/resident-interface with your actual branch name.

The -u option connects your local branch to its remote counterpart. You generally only need it for the first push of that branch.

For subsequent pushes, run:

git push

After pushing, your branch and commits should appear on GitHub.

Remember: Pushing your branch does not automatically merge your changes into main.

⸻

10. Create a Pull Request (PR)

A Pull Request lets your teammate review your changes before they become part of the main project.

Step 1: Open the repository on GitHub

After pushing your branch, navigate to the ReportPoint repository.

GitHub may display a notification with a button labeled Compare & pull request.

Click it.

If the button does not appear:

1. Open the Pull requests tab.
2. Click New pull request.
3. Select main as the base branch.
4. Select your feature branch as the compare branch.

The direction should be:

base: main  ←  compare: feature/resident-interface

This means you are proposing to merge your feature branch into main.

Step 2: Describe your changes

Give the PR a clear title.

Example:

Add resident report submission interface

In the description, explain what you changed and how you tested it.

Example:

## Changes
- Added the resident report submission page.
- Updated the form layout and styling.
- Added basic client-side validation.
## Testing
- Checked the page in the browser.
- Tested the form with valid and invalid inputs.
## Notes
- Backend integration is not included yet.

Only include statements that accurately describe your work.

Step 3: Submit the PR

Click Create pull request.

Your teammate can now review your changes and leave comments.

Step 4: Address review comments

If changes are requested:

1. Return to your existing feature branch.
2. Edit the necessary files.
3. Commit the fixes.
4. Push your branch again.

For example:

git add .
git commit -m "Address resident interface review comments"
git push

The new commits will automatically appear in the same PR.

You generally do not need to create a new PR for these revisions.

Step 5: Merge the PR

Once the changes are reviewed and approved, the person responsible for merging can merge the PR into main.

Follow the team’s agreed review process and repository rules.

Do not delete your branch until you’re sure the changes have been merged and you no longer need the branch.

⸻

11. Get Updates After Your Teammate Merges Changes

Suppose Vinnie merges the resident interface into main, and you need those changes on your computer.

First, commit or safely store your own work.

Then run:

git switch main
git pull origin main

Your local main branch will now include the changes merged into the remote main branch.

What if you’re still working on your own branch?

You can update your feature branch with the latest changes from main.

First, make sure your current changes are committed or safely stored.

Then run:

git fetch origin
git switch feature/admin-interface
git merge origin/main

Replace the branch name with your actual feature branch.

This brings the latest remote main changes into your feature branch.

If Git reports conflicts, resolve them before continuing.

⸻

12. Common Git Commands

Keep this table as a quick reference.

Command	Purpose
git status	Check your current branch and working-tree changes.
git branch	List local branches.
git switch main	Switch to the main branch.
git pull origin main	Download and integrate changes from remote main.
git switch -c feature/my-feature	Create and switch to a new branch.
git add .	Stage changes in the current directory and its subdirectories.
git add path/to/file	Stage a specific file.
git diff	Review unstaged changes to tracked files.
git commit -m "Your message"	Create a commit.
git push -u origin feature/my-feature	Push a new branch and set its upstream.
git push	Push commits to the configured remote branch.
git fetch origin	Download remote updates without integrating them into your current branch.
git merge origin/main	Merge remote main into the current branch.
git log --oneline -5	View the five most recent commits.

⸻

13. Common Problems and How to Handle Them

Problem A: git push is rejected

This can happen when the remote branch has commits that your local branch doesn’t have.

First, inspect the error and check your branch:

git status
git branch

If you’re working on your feature branch, you may need to fetch the remote changes and integrate them.

git fetch origin

Read the error message before deciding whether to merge, rebase, or take another action.

Avoid using git push --force as a quick fix. It can overwrite remote history and interfere with your teammate’s work.

Problem B: I don’t know which branch I’m on

Run:

git branch

The asterisk shows the current branch.

You can also run:

git status

Problem C: I edited the wrong branch

Don’t panic or immediately reset your changes.

Check your current state first:

git status

If you haven’t committed anything, avoid switching branches until you’ve safely stored your changes.

Ask your teammate for help if you’re unsure how to transfer your work.

Problem D: Git reports a merge conflict

A conflict happens when Git cannot automatically combine competing changes.

1. Run git status to identify the affected files.
2. Open those files in VS Code.
3. Find the conflict markers.
4. Decide which changes to keep and combine the correct code.
5. Remove the conflict markers.
6. Test the affected files.
7. Stage the resolved files.
8. Complete the merge or rebase according to the operation Git started.

Conflict markers look like this:

<<<<<<< HEAD
Your current changes
=======
Incoming changes
>>>>>>> origin/main

These markers are examples. Never leave them in the final source code.

If you’re unsure which version to keep, ask your teammate before resolving the conflict.

Problem E: I accidentally staged a file

To unstage a file without deleting your changes, run:

git restore --staged path/to/file

Replace the example path with the actual file path.

Problem F: I want to check what I committed

Run:

git log --oneline -5

This displays your five most recent commits.

⸻

14. Our Team’s Recommended Workflow

For ReportPoint, use this workflow for each feature.

Before coding:

git switch main
git pull origin main
git switch -c feature/my-feature

Replace feature/my-feature with a descriptive branch name.

After coding:

git status
git diff
git add .
git commit -m "Describe your changes"
git push -u origin feature/my-feature

If you’ve already pushed this branch before, use git push instead of the first-push command.

On GitHub:

1. Open the repository.
2. Create a PR from your feature branch into main.
3. Describe your changes and testing.
4. Ask your teammate to review the PR.
5. Address feedback if needed.
6. Merge the PR once it meets the team’s agreed requirements.

After the PR is merged:

git switch main
git pull origin main

Repeat this workflow for each new feature.

⸻

15. Rules for Working Together

To keep development organized:

1. Never commit directly to main for regular feature work.
2. Create a separate branch for each feature or task.
3. Pull the latest changes before starting new work.
4. Commit changes using clear, descriptive messages.
5. Push your branch to GitHub when you’re ready to share your work.
6. Open a PR so your teammate can review your changes.
7. Communicate before modifying files used by both interfaces.
8. Test your changes before requesting a review.
9. Never commit passwords, database credentials, private keys, or .env files.
10. Never use destructive Git commands unless you understand their effects and have confirmed your work is safe.

Goal: Keep main as the shared, stable version of ReportPoint, while each team member develops and tests features on their own branch.
