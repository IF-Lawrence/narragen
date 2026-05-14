// Novel outline templates for quick start

// Template categories for grouping
export const templateCategories = [
    { key: 'serious', label: '严肃文学', description: '纯文学与畅销书经典结构' },
    { key: 'romance', label: '言情小说', description: '多种言情叙事套路' },
    { key: 'fantasy', label: '玄幻修仙', description: '东方幻想世界观' },
    { key: 'urban', label: '都市传奇', description: '现代都市背景故事' },
    { key: 'history', label: '历史架空', description: '穿越与历史演绎' },
];

export const outlineTemplates = [
    // ========== 严肃文学 ==========
    {
        id: 'family_saga',
        name: '家族史诗',
        category: 'serious',
        icon: '🏛️',
        description: '现实主义 | 年代跨度 | 群像叙事',
        storyFields: {
            mainPlot: '一个家族几代人的命运沉浮，折射时代变迁与人性挣扎',
            mainConflict: '家族内部矛盾、时代洪流冲击、理想与现实的碰撞',
            storyBeginning: '以一个标志性事件或人物视角切入家族历史',
            expectedEnding: '家族命运的最终走向，对主题的深化与升华'
        },
        worldFields: {
            timePeriod: '跨越数十年的历史时期',
            mainSettings: '家族宅院、乡土村落、时代变迁中的城市',
            worldFeatures: '真实历史背景、地域文化特色、社会风貌',
            socialRules: '传统宗族礼法、时代政治背景、阶层分化'
        },
        characters: [
            { name: '家族长辈', role: '家族支柱', description: '承载传统与记忆的核心人物' },
            { name: '年轻一代', role: '主角', description: '在传统与现代之间抉择的后代' }
        ],
        options: {
            novelType: '现实主义',
            targetAudience: ['成熟读者', '文学爱好者'],
            tone: '厚重史诗',
            length: 'long',
            characterCount: 8,
            narrativeStyle: '群像叙事',
            literaryDepth: '兼具深度'
        }
    },
    {
        id: 'coming_of_age',
        name: '成长小说',
        category: 'serious',
        icon: '🌱',
        description: '青春成长 | 心理描写 | 人生转折',
        storyFields: {
            mainPlot: '主人公从青涩走向成熟的心路历程',
            mainConflict: '自我认同危机、与世界的冲突、成长的代价',
            storyBeginning: '一个打破平静生活的事件，或一段特殊的相遇',
            expectedEnding: '获得成长与领悟，虽有遗憾但走向新生'
        },
        worldFields: {
            timePeriod: '当代或近现代',
            mainSettings: '校园、家庭、城市街巷',
            worldFeatures: '青春期特有的敏感与迷茫、友情与初恋',
            socialRules: '家庭期望、同辈压力、社会规范'
        },
        characters: [
            { name: '主人公', role: '主角', description: '敏感、迷茫但真诚的年轻人' },
            { name: '引路人', role: '导师', description: '影响主角成长的关键人物' }
        ],
        options: {
            novelType: '成长小说',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '细腻抒情',
            length: 'medium',
            characterCount: 4,
            narrativeStyle: '单一视角',
            literaryDepth: '兼具深度'
        }
    },
    {
        id: 'social_mystery',
        name: '社会派推理',
        category: 'serious',
        icon: '🔍',
        description: '悬疑推理 | 社会批判 | 人性探讨',
        storyFields: {
            mainPlot: '通过案件调查揭示社会阴暗面和人性复杂性',
            mainConflict: '真相与谎言的博弈、正义与法律的矛盾、人性的善恶边界',
            storyBeginning: '一起看似普通却暗藏玄机的案件发生',
            expectedEnding: '真相大白，但留下对社会和人性的深刻思考'
        },
        worldFields: {
            timePeriod: '当代社会',
            mainSettings: '都市、底层社区、司法机构',
            worldFeatures: '社会现实问题、阶层差异、制度漏洞',
            socialRules: '法律体系、潜规则、人情世故'
        },
        characters: [
            { name: '调查者', role: '主角', description: '执着追寻真相的侦探或记者' },
            { name: '嫌疑人', role: '关键人物', description: '有着复杂过往和动机的人物' }
        ],
        options: {
            novelType: '悬疑犯罪',
            targetAudience: ['成熟读者', '通俗大众'],
            tone: '紧张悬疑',
            length: 'medium',
            characterCount: 6,
            narrativeStyle: '多线交织',
            literaryDepth: '兼具深度'
        }
    },
    {
        id: 'literary_romance',
        name: '纯文学爱情',
        category: 'serious',
        icon: '💌',
        description: '情感文学 | 细腻叙事 | 人物内心',
        storyFields: {
            mainPlot: '两个灵魂的相遇、理解与错过，探讨爱情的本质',
            mainConflict: '性格差异、时空阻隔、内心障碍、命运捉弄',
            storyBeginning: '一次不期而遇或命中注定的相逢',
            expectedEnding: '或圆满或遗憾，但都指向对爱与人生的感悟'
        },
        worldFields: {
            timePeriod: '不限，可跨越时空',
            mainSettings: '具有象征意义的场所、充满回忆的地点',
            worldFeatures: '诗意的氛围、情感的张力、时间的流逝',
            socialRules: '社会观念、家庭期望、时代背景'
        },
        characters: [
            { name: '主人公', role: '主角', description: '有深度的情感世界，渴望真正的理解' },
            { name: '恋人', role: '对手戏', description: '与主角形成张力的另一个灵魂' }
        ],
        options: {
            novelType: '现实主义',
            targetAudience: ['文学爱好者', '成熟读者'],
            tone: '细腻抒情',
            length: 'medium',
            characterCount: 3,
            narrativeStyle: '双主角',
            literaryDepth: '纯文学'
        }
    },

    // ========== 言情小说 ==========
    {
        id: 'ceo_mansion',
        name: '总裁豪门',
        category: 'romance',
        icon: '👔',
        description: '现代都市 | 1v1 | 女性向',
        storyFields: {
            mainPlot: '灰姑娘与豪门继承人的爱情故事，身份悬殊却真心相爱',
            mainConflict: '家族反对，豪门恩怨，商业阴谋',
            storyBeginning: '女主意外救了豪门少爷，两人结缘',
            expectedEnding: '克服重重阻碍，有情人终成眷属'
        },
        worldFields: {
            timePeriod: '现代都市',
            mainSettings: '豪门别墅、高级会所、商业中心',
            worldFeatures: '豪门世家，商业帝国，上流社会',
            socialRules: '豪门家族规矩，商业联姻传统'
        },
        characters: [
            { name: '苏晴', role: '女主角', description: '善良坚强的平凡女孩' },
            { name: '顾云深', role: '男主角', description: '豪门继承人，冷酷多金' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '温馨治愈',
            length: 'medium',
            characterCount: 5,
            narrativeStyle: '双主角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'farming_business',
        name: '种田经商',
        category: 'romance',
        icon: '🌾',
        description: '古代言情 | 1v1 | 女性向',
        storyFields: {
            mainPlot: '现代人穿越到古代，利用现代知识发家致富',
            mainConflict: '生存压力，商业竞争，宅斗阴谋',
            storyBeginning: '穿越成贫困农家女，决心改变命运',
            expectedEnding: '事业有成，家族兴旺，收获爱情'
        },
        worldFields: {
            timePeriod: '古代（架空朝代）',
            mainSettings: '农村、集市、京城',
            worldFeatures: '农耕文化，商业贸易，传统手工艺',
            socialRules: '男尊女卑，宗族制度，商人地位低'
        },
        characters: [
            { name: '沈清', role: '女主角', description: '穿越女，聪慧能干' },
            { name: '萧煜', role: '男主角', description: '温润儒雅的书生' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '轻松幽默',
            length: 'long',
            characterCount: 6,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'palace_intrigue',
        name: '宫闱宅斗',
        category: 'romance',
        icon: '👑',
        description: '古代言情 | 多CP | 女性向',
        storyFields: {
            mainPlot: '女主在后宫或大宅中斗智斗勇，步步为营',
            mainConflict: '后宫争宠，宅门恩怨，权力斗争',
            storyBeginning: '入宫选秀或嫁入豪门，卷入斗争',
            expectedEnding: '笑到最后，掌握实权或获得真爱'
        },
        worldFields: {
            timePeriod: '古代（宫廷或大宅）',
            mainSettings: '皇宫、后宫、侯府',
            worldFeatures: '宫廷礼仪，等级森严，勾心斗角',
            socialRules: '皇权至上，嫡庶有别，三从四德'
        },
        characters: [
            { name: '慕容雪', role: '女主角', description: '聪慧冷静的宫妃' },
            { name: '皇帝', role: '男主角', description: '深沉多疑的帝王' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '紧张悬疑',
            length: 'long',
            characterCount: 10,
            narrativeStyle: '群像叙事',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'ancient_love',
        name: '古代情缘',
        category: 'romance',
        icon: '🏮',
        description: '古代言情 | 1v1 | 女性向',
        storyFields: {
            mainPlot: '古代背景下的纯爱故事，青梅竹马或一见钟情',
            mainConflict: '家族反对，战乱分离，误会重重',
            storyBeginning: '两人相识相知，情愫暗生',
            expectedEnding: '有情人终成眷属，白头偕老'
        },
        worldFields: {
            timePeriod: '古代（历史朝代）',
            mainSettings: '江南水乡、京城、边塞',
            worldFeatures: '传统文化，诗词歌赋，江湖侠义',
            socialRules: '父母之命媒妁之言，门当户对'
        },
        characters: [
            { name: '柳如烟', role: '女主角', description: '温婉贤淑的大家闺秀' },
            { name: '陈墨轩', role: '男主角', description: '才华横溢的书生' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '温馨治愈',
            length: 'medium',
            characterCount: 4,
            narrativeStyle: '双主角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'era_rebirth',
        name: '年代重生',
        category: 'romance',
        icon: '⏰',
        description: '现代都市 | 1v1 | 女性向',
        storyFields: {
            mainPlot: '重生回到过去年代，利用先知优势改写人生',
            mainConflict: '改变命运，对抗恶人，把握机遇',
            storyBeginning: '意外重生到六七十年代',
            expectedEnding: '事业成功，家庭幸福，人生圆满'
        },
        worldFields: {
            timePeriod: '1960-1990年代中国',
            mainSettings: '农村、工厂、国营单位',
            worldFeatures: '时代特色，计划经济，改革开放',
            socialRules: '单位分配，票证制度，集体主义'
        },
        characters: [
            { name: '张慧', role: '女主角', description: '重生女，知晓未来' },
            { name: '李建国', role: '男主角', description: '正直能干的工人' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['成熟读者', '通俗大众'],
            tone: '轻松幽默',
            length: 'long',
            characterCount: 6,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },

    // ========== 玄幻修仙 ==========
    {
        id: 'xianxia_fantasy',
        name: '玄幻仙侠',
        category: 'fantasy',
        icon: '🗡️',
        description: '玄幻修仙 | 1v1 | 全年龄',
        storyFields: {
            mainPlot: '少年踏上修仙之路，历经磨难成为仙界强者',
            mainConflict: '修炼瓶颈，宗门争斗，魔道入侵',
            storyBeginning: '偶得仙缘，开启修仙之旅',
            expectedEnding: '飞升仙界，成就仙尊之位'
        },
        worldFields: {
            timePeriod: '架空修仙世界',
            mainSettings: '修仙宗门、秘境、仙界',
            worldFeatures: '修炼等级体系，法宝丹药，仙兽灵宠',
            socialRules: '强者为尊，宗门规矩，修仙界秩序'
        },
        characters: [
            { name: '林风', role: '主角', description: '天赋异禀的修仙者' },
            { name: '月灵', role: '女主角', description: '仙子般的修仙天才' }
        ],
        options: {
            novelType: '玄幻',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '厚重史诗',
            length: 'long',
            characterCount: 8,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'eastern_fantasy',
        name: '东方玄幻',
        category: 'fantasy',
        icon: '🔮',
        description: '玄幻修仙 | 多CP | 男性向',
        storyFields: {
            mainPlot: '东方玄幻世界，主角修炼成神，征战四方',
            mainConflict: '种族战争，神魔对立，天道考验',
            storyBeginning: '获得神秘功法，踏上强者之路',
            expectedEnding: '成就神位，统御万界'
        },
        worldFields: {
            timePeriod: '架空东方玄幻世界',
            mainSettings: '修炼圣地、神魔战场、上古遗迹',
            worldFeatures: '东方神话体系，炼器炼丹，阵法符咒',
            socialRules: '强者为尊，宗门势力，种族划分'
        },
        characters: [
            { name: '楚天', role: '主角', description: '逆天改命的修炼者' },
            { name: '紫霄', role: '女主角', description: '神秘强大的仙子' }
        ],
        options: {
            novelType: '玄幻',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '厚重史诗',
            length: 'long',
            characterCount: 10,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'otherworld_continent',
        name: '异界大陆',
        category: 'fantasy',
        icon: '🌌',
        description: '玄幻修仙 | 多CP | 男性向',
        storyFields: {
            mainPlot: '穿越到异界大陆，从弱小到称霸一方',
            mainConflict: '大陆争霸，种族冲突，强者林立',
            storyBeginning: '穿越异界，获得金手指',
            expectedEnding: '成为大陆最强者，建立帝国'
        },
        worldFields: {
            timePeriod: '架空异界大陆',
            mainSettings: '魔法学院、帝国王城、魔兽森林',
            worldFeatures: '魔法斗气体系，魔兽契约，种族多样',
            socialRules: '强者为尊，帝国制度，佣兵工会'
        },
        characters: [
            { name: '萧炎', role: '主角', description: '穿越者，天赋异禀' },
            { name: '美杜莎', role: '女主角', description: '蛇人族女王' }
        ],
        options: {
            novelType: '玄幻',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '厚重史诗',
            length: 'long',
            characterCount: 12,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'urban_cultivation',
        name: '都市修仙',
        category: 'fantasy',
        icon: '🌟',
        description: '现代都市 | 1v1 | 男性向',
        storyFields: {
            mainPlot: '修仙者重生都市，以修仙之力纵横现代社会',
            mainConflict: '修仙界与现代社会的冲突，隐藏势力',
            storyBeginning: '仙帝重生到现代都市',
            expectedEnding: '重回巅峰，飞升仙界'
        },
        worldFields: {
            timePeriod: '现代都市',
            mainSettings: '都市、修仙秘境、隐世宗门',
            worldFeatures: '现代科技与修仙结合，灵气复苏',
            socialRules: '表面现代社会，暗藏修仙世界'
        },
        characters: [
            { name: '陈北玄', role: '主角', description: '重生的仙帝' },
            { name: '安雅', role: '女主角', description: '现代都市女孩' }
        ],
        options: {
            novelType: '玄幻',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '紧张悬疑',
            length: 'long',
            characterCount: 7,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },

    // ========== 都市传奇 ==========
    {
        id: 'supernatural_power',
        name: '异术超能',
        category: 'urban',
        icon: '⚡',
        description: '现代都市 | 1v1 | 全年龄',
        storyFields: {
            mainPlot: '现代都市中觉醒超能力，守护城市和平',
            mainConflict: '超能力组织斗争，邪恶势力威胁',
            storyBeginning: '意外获得超能力',
            expectedEnding: '成为超能力界的传奇'
        },
        worldFields: {
            timePeriod: '现代都市',
            mainSettings: '都市、秘密基地、异能组织',
            worldFeatures: '超能力体系，秘密组织，现代科技',
            socialRules: '隐藏身份，超能力管理局，普通人不知情'
        },
        characters: [
            { name: '王浩', role: '主角', description: '觉醒超能力的普通人' },
            { name: '苏雅', role: '女主角', description: '异能组织成员' }
        ],
        options: {
            novelType: '科幻',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '紧张悬疑',
            length: 'medium',
            characterCount: 6,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },
    {
        id: 'urban_expert',
        name: '都市高手',
        category: 'urban',
        icon: '🥋',
        description: '现代都市 | 多CP | 男性向',
        storyFields: {
            mainPlot: '隐藏高手回归都市，纵横商界和地下世界',
            mainConflict: '商业竞争，地下势力，仇家寻仇',
            storyBeginning: '退隐高手因故回归都市',
            expectedEnding: '称霸都市，事业爱情双丰收'
        },
        worldFields: {
            timePeriod: '现代都市',
            mainSettings: '商业中心、地下拳场、豪华别墅',
            worldFeatures: '现代都市，地下势力，商业帝国',
            socialRules: '江湖规矩，商业法则，强者为尊'
        },
        characters: [
            { name: '叶天', role: '主角', description: '隐藏的绝世高手' },
            { name: '林诗雨', role: '女主角', description: '冰山总裁' }
        ],
        options: {
            novelType: '言情',
            targetAudience: ['青年读者', '通俗大众'],
            tone: '轻松幽默',
            length: 'long',
            characterCount: 8,
            narrativeStyle: '单一视角',
            literaryDepth: '通俗流畅'
        }
    },

    // ========== 历史架空 ==========
    {
        id: 'time_travel_history',
        name: '穿越历史',
        category: 'history',
        icon: '📜',
        description: '历史架空 | 1v1 | 男性向',
        storyFields: {
            mainPlot: '穿越到历史朝代，利用现代知识改变历史',
            mainConflict: '权力斗争，战争征伐，改变历史',
            storyBeginning: '穿越成为历史人物或普通人',
            expectedEnding: '建功立业，名垂青史'
        },
        worldFields: {
            timePeriod: '中国古代历史朝代',
            mainSettings: '朝堂、战场、江湖',
            worldFeatures: '历史背景，真实人物，架空演绎',
            socialRules: '封建制度，科举制度，等级森严'
        },
        characters: [
            { name: '李明', role: '主角', description: '穿越者，知晓历史' },
            { name: '王昭君', role: '女主角', description: '历史美人' }
        ],
        options: {
            novelType: '历史',
            targetAudience: ['成熟读者', '通俗大众'],
            tone: '厚重史诗',
            length: 'long',
            characterCount: 8,
            narrativeStyle: '单一视角',
            literaryDepth: '兼具深度'
        }
    }
];
