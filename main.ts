import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as dotenv from 'dotenv';

dotenv.config();
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN; // Replace with your actual API token

// Function to get today's date in the correct format (YYYY-MM-DDTHH:mm)
function getTodayDate() {
	const today = new Date();
	return `${today.toISOString().split("T")[0]}T00:00`;
}

// Function to fetch completed tasks from Todoist for today
async function getCompletedTasksForToday() {
	const todayDate = getTodayDate();
	const response = await fetch(
		`https://api.todoist.com/sync/v9/completed/get_all?since=${todayDate}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${TODOIST_API_TOKEN}`,
			},
		}
	);

	if (response.ok) {
		const data = await response.json();
		return data.items || []; // Ensure you return items or an empty array
	} else {
		console.error(
			"Failed to fetch completed tasks",
			response.status,
			await response.text()
		);
		return [];
	}
}

interface MyPluginSettings {
	mySetting: string;
	processedTaskIds: string[]; // Add this to store processed task IDs
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
	processedTaskIds: [], // Initialize with an empty array
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerInterval(
			window.setInterval(async () => {
				const tasks = await getCompletedTasksForToday();
				new Notice("hello " + JSON.stringify(tasks));

				tasks.forEach(
					async (task: {
						id: any;
						content: any;
						subtasks: never[];
					}) => {
						const taskId = task.id;
						// Check if the task is already processed
						if (!this.settings.processedTaskIds.includes(taskId)) {
							const taskName = task.content;
							const subtasks = task.subtasks || []; // If there are subtasks

							// Create markdown page for the task with ID and link
							await this.createTaskPage(
								taskName,
								subtasks,
								taskId
							);

							// Mark the task as processed
							this.settings.processedTaskIds.push(taskId);
							await this.saveSettings();
						}
					}
				);

				new Notice("Completed tasks for today updated.");
			}, 10 * 1000) // 10 seconds interval
		);

		// Load the first batch of tasks immediately on load
		const tasks = await getCompletedTasksForToday();
		tasks.forEach(
			async (task: { id: any; content: any; subtasks: never[] }) => {
				const taskId = task.id;

				if (!this.settings.processedTaskIds.includes(taskId)) {
					const taskName = task.content;
					const subtasks = task.subtasks || [];

					await this.createTaskPage(taskName, subtasks, taskId);

					this.settings.processedTaskIds.push(taskId);
					await this.saveSettings();
				}
			}
		);

		new Notice("Fetched today's completed tasks");
	}

	// Function to create a markdown page for a task
	async createTaskPage(
		taskName: string,
		subtasks: Array<any>,
		taskId: string
	) {
		// Create the content for the task page
		let pageContent = `# ${taskName}\n\n`;

		// Add a link to the Todoist task using its ID
		const taskUrl = `https://todoist.com/showTask?id=${taskId}`;
		pageContent += `- [Open in Todoist](${taskUrl})\n\n`;

		// Add any subtasks, if they exist
		if (subtasks.length > 0) {
			pageContent += `## Subtasks:\n`;
			subtasks.forEach((subtask) => {
				pageContent += `- ${subtask.content}\n`;
			});
		}

		// Use Obsidian's file system to create a new file
		const fileName = `${taskName.replace(/[^a-zA-Z0-9]/g, "_")}.md`; // Sanitize file name
		const filePath = `Tasks/${fileName}`; // Customize the folder path

		// Create the file with the generated content
		await this.app.vault.create(filePath, pageContent);

		new Notice(`Created task file: ${fileName}`);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
