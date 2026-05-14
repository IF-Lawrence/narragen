export class BaseAgent {
  constructor(name, temperature = 0.7) {
    this.name = name;
    this.temperature = temperature;
  }

  async execute(context) {
    throw new Error('Must implement execute method');
  }

  async generatePrompt(context) {
    throw new Error('Must implement generatePrompt method');
  }

  async validate(result) {
    return typeof result === 'string' && result.trim().length > 0;
  }
}

