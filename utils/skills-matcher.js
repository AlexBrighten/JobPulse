// utils/skills-matcher.js — Keyword extraction and resume-to-JD matching engine

const SkillsMatcher = {
  // ─── Curated skills database grouped by category ───
  SKILLS_DB: {
    'Languages': [
      'javascript','typescript','python','java','c++','c#','go','golang','rust','ruby','php',
      'swift','kotlin','scala','r','matlab','perl','shell','bash','powershell','sql','html',
      'css','sass','scss','less','graphql','solidity','elixir','haskell','lua','dart','objective-c',
      'assembly','cobol','fortran','groovy','clojure','f#','visual basic','vba'
    ],
    'Frontend': [
      'react','react.js','reactjs','angular','vue','vue.js','vuejs','svelte','next.js','nextjs',
      'nuxt','nuxt.js','gatsby','remix','astro','redux','mobx','zustand','recoil','jotai',
      'jquery','bootstrap','tailwind','tailwindcss','material ui','mui','chakra ui','ant design',
      'styled-components','emotion','css modules','webpack','vite','rollup','parcel','babel',
      'eslint','prettier','storybook','chromatic','figma','sketch','adobe xd','responsive design',
      'accessibility','a11y','wcag','seo','pwa','service workers','web components','shadow dom',
      'webgl','three.js','d3','d3.js','canvas','svg','animation','framer motion','gsap',
      'cypress','playwright','jest','testing library','vitest','enzyme','puppeteer','selenium'
    ],
    'Backend': [
      'node','node.js','nodejs','express','express.js','fastify','nestjs','nest.js','koa','hapi',
      'django','flask','fastapi','spring','spring boot','rails','ruby on rails','laravel','symfony',
      'asp.net','.net','dotnet','.net core','gin','echo','fiber','actix','rocket','phoenix',
      'sinatra','tornado','aiohttp','uvicorn','gunicorn','nginx','apache','caddy','iis',
      'rest','restful','rest api','soap','grpc','rpc','websocket','socket.io','sse',
      'oauth','oauth2','jwt','saml','openid','passport','auth0','okta','keycloak',
      'rate limiting','caching','load balancing','reverse proxy','api gateway','kong','apigee'
    ],
    'Databases': [
      'postgresql','postgres','mysql','mariadb','mongodb','mongo','redis','memcached',
      'elasticsearch','elastic','opensearch','dynamodb','cassandra','sqlite','oracle','sql server',
      'mssql','firebase','firestore','supabase','planetscale','cockroachdb','neo4j','arangodb',
      'couchdb','couchbase','influxdb','timescaledb','clickhouse','druid','prisma','sequelize',
      'typeorm','knex','mongoose','sqlalchemy','hibernate','active record','database design',
      'data modeling','normalization','indexing','query optimization','stored procedures',
      'replication','sharding','partitioning','etl','data pipeline','data warehouse','olap','oltp'
    ],
    'Cloud & DevOps': [
      'aws','amazon web services','azure','gcp','google cloud','google cloud platform',
      'docker','kubernetes','k8s','terraform','ansible','puppet','chef','vagrant',
      'jenkins','circleci','github actions','gitlab ci','travis ci','argocd','spinnaker',
      'helm','istio','envoy','consul','vault','packer','cloudformation','cdk','sam',
      'lambda','serverless','ecs','eks','aks','gke','fargate','ec2','s3','rds','sqs','sns',
      'cloudfront','route53','api gateway','step functions','eventbridge',
      'prometheus','grafana','datadog','new relic','splunk','elk','kibana','logstash',
      'fluentd','jaeger','zipkin','opentelemetry','observability','monitoring','alerting',
      'ci/cd','continuous integration','continuous deployment','continuous delivery',
      'infrastructure as code','iac','site reliability','sre','devops','devsecops',
      'cloud native','multi-cloud','hybrid cloud','edge computing','cdn'
    ],
    'Data & ML': [
      'pandas','numpy','scipy','scikit-learn','sklearn','tensorflow','pytorch','keras',
      'xgboost','lightgbm','catboost','hugging face','transformers','bert','gpt','llm',
      'nlp','natural language processing','computer vision','opencv','deep learning',
      'machine learning','ml','ai','artificial intelligence','neural networks','cnn','rnn',
      'lstm','gan','reinforcement learning','supervised learning','unsupervised learning',
      'feature engineering','model training','mlops','mlflow','kubeflow','sagemaker',
      'spark','pyspark','hadoop','hive','presto','trino','airflow','dagster','prefect',
      'dbt','snowflake','bigquery','redshift','databricks','delta lake','apache beam',
      'kafka','rabbitmq','pulsar','flink','storm','stream processing','batch processing',
      'data engineering','data science','data analytics','business intelligence','bi',
      'tableau','power bi','looker','metabase','jupyter','notebook','colab',
      'statistics','regression','classification','clustering','dimensionality reduction',
      'a/b testing','experimentation','hypothesis testing','bayesian','time series'
    ],
    'Mobile': [
      'react native','flutter','swiftui','uikit','jetpack compose','kotlin multiplatform',
      'xamarin','ionic','capacitor','expo','android','ios','mobile development',
      'app store','play store','push notifications','deep linking','offline first',
      'core data','room','realm','sqlite mobile','firebase mobile','crashlytics',
      'app performance','mobile testing','appium','detox','xctest','espresso'
    ],
    'Architecture & Practices': [
      'microservices','monolith','serverless architecture','event-driven','event sourcing',
      'cqrs','domain-driven design','ddd','clean architecture','hexagonal','mvc','mvvm',
      'solid','design patterns','singleton','factory','observer','strategy','decorator',
      'tdd','test-driven development','bdd','behavior-driven development','unit testing',
      'integration testing','end-to-end testing','e2e','load testing','performance testing',
      'agile','scrum','kanban','lean','sprint','retrospective','standup','jira','confluence',
      'git','github','gitlab','bitbucket','version control','branching strategy','git flow',
      'trunk-based development','code review','pull request','pair programming','mob programming',
      'documentation','technical writing','api documentation','swagger','openapi','postman',
      'system design','scalability','high availability','fault tolerance','disaster recovery',
      'distributed systems','consensus','raft','paxos','cap theorem','eventual consistency',
      'caching strategies','message queues','pub/sub','saga pattern','circuit breaker',
      'security','encryption','ssl','tls','https','xss','csrf','sql injection','owasp',
      'penetration testing','vulnerability assessment','compliance','gdpr','hipaa','sox','pci'
    ],
    'Soft Skills': [
      'leadership','mentoring','coaching','team lead','tech lead','engineering manager',
      'communication','presentation','stakeholder management','cross-functional',
      'problem solving','critical thinking','analytical','strategic thinking',
      'project management','program management','product management','roadmap',
      'collaboration','teamwork','remote work','async communication',
      'startup','fast-paced','self-starter','entrepreneurial','ownership','autonomy'
    ]
  },

  // ─── Build flat lookup set (cached) ───
  _flatSkills: null,
  _skillToCategory: null,

  _buildLookups() {
    if (this._flatSkills) return;
    this._flatSkills = new Set();
    this._skillToCategory = {};
    for (const [category, skills] of Object.entries(this.SKILLS_DB)) {
      for (const skill of skills) {
        this._flatSkills.add(skill.toLowerCase());
        this._skillToCategory[skill.toLowerCase()] = category;
      }
    }
  },

  /**
   * Extract recognized skill keywords from a block of text (job description).
   * Returns an array of { skill, category } objects.
   */
  extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    this._buildLookups();

    const normalized = text.toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"');

    const found = new Map(); // skill -> category

    // Multi-word match first (longer phrases first)
    const allSkills = Array.from(this._flatSkills).sort((a, b) => b.length - a.length);

    for (const skill of allSkills) {
      if (found.has(skill)) continue;

      // Build a regex for word-boundary matching to prevent false positives on substrings
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|[\\s,;:()/\\[\\]|•·–—"'<>\n\r])${escaped}(?:$|[\\s,;:()/\\[\\]|•·–—"'<>\n\r])`, 'i');

      if (pattern.test(normalized)) {
        found.set(skill, this._skillToCategory[skill]);
      }
    }

    return Array.from(found.entries()).map(([skill, category]) => ({ skill, category }));
  },

  /**
   * Match job description keywords against user's skills.
   * @param {string} jobDescription - Full job posting text
   * @param {string[]} userSkills - User's known skills (optional, defaults to common set)
   * @returns {{ score: number, matched: Array, missing: Array, jdKeywords: Array, breakdown: Object }}
   */
  matchSkills(jobDescription, userSkills = []) {
    const jdKeywords = this.extractKeywords(jobDescription);
    if (jdKeywords.length === 0) {
      return { score: 0, matched: [], missing: [], jdKeywords: [], breakdown: {} };
    }

    const userSet = new Set(userSkills.map(s => s.toLowerCase().trim()));
    const matched = [];
    const missing = [];
    const breakdown = {};

    for (const kw of jdKeywords) {
      if (!breakdown[kw.category]) breakdown[kw.category] = { matched: 0, missing: 0, total: 0 };
      breakdown[kw.category].total++;

      if (userSet.has(kw.skill)) {
        matched.push(kw);
        breakdown[kw.category].matched++;
      } else {
        missing.push(kw);
        breakdown[kw.category].missing++;
      }
    }

    const score = jdKeywords.length > 0
      ? Math.round((matched.length / jdKeywords.length) * 100)
      : 0;

    return { score, matched, missing, jdKeywords, breakdown };
  },

  /**
   * Auto-analyze: extract JD skills and return a summary even without user skills.
   * Useful for showing "Skills required for this role" independent of user input.
   */
  analyzeJobDescription(jobDescription) {
    const keywords = this.extractKeywords(jobDescription);
    const byCategory = {};

    for (const kw of keywords) {
      if (!byCategory[kw.category]) byCategory[kw.category] = [];
      byCategory[kw.category].push(kw.skill);
    }

    return {
      totalSkills: keywords.length,
      keywords,
      byCategory,
      topCategories: Object.entries(byCategory)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([cat, skills]) => ({ category: cat, count: skills.length, skills }))
    };
  },

  /**
   * Get all available skill categories for the user to pick from.
   */
  getCategories() {
    return Object.keys(this.SKILLS_DB);
  },

  /**
   * Get all skills in a specific category.
   */
  getSkillsByCategory(category) {
    return this.SKILLS_DB[category] || [];
  },

  /**
   * Get a flat list of all skills (for autocomplete, etc.)
   */
  getAllSkills() {
    this._buildLookups();
    return Array.from(this._flatSkills);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkillsMatcher;
}
