const radial = new Radial();

async function getData() {

    const code = await d3.csv("data/maven/code.csv");
    const commit = await d3.csv("data/maven/commits.csv");
    const bug = await d3.csv("data/maven/bug.csv");
    const improvement = await d3.csv("data/maven/improvement.csv");

    const codeCommit = await d3.csv("data/maven/CommitCodeLinks.csv");
    const bugCommit = await d3.csv("data/maven/bugCommitLinks.csv");
    const improvementCommit = await d3.csv("data/maven/improvementCommitLinks.csv");
    const issuesLinks = await d3.csv("data/maven/issuesLinks.csv");
    
    const allNodes = [];
    const allLinks = [];

    const parseTimeEDT = d3.timeParse("%a %b %d %H:%M:%S EDT %Y");
    const parseTimeEST = d3.timeParse("%a %b %d %H:%M:%S EST %Y");

    formatNode(code, "code");
    formatNode(commit, "commit");
    formatNode(bug, "bug");
    formatNode(improvement, "improvement");
    console.log(improvement);

    addLinkSourceTarget(codeCommit, "class_id", "issue_id", "code", "commit");
    addLinkSourceTarget(bugCommit, "issue_id", "commit_id", "bug", "commit");
    addLinkSourceTarget(improvementCommit, "issue_id", "commit_id", "improvement", "commit");
    addLinkSourceTarget(issuesLinks, "issue_id_1", "issue_id_2", "issue", "issue");

    function formatNode(nodes, type) {
        nodes.forEach(d => {
            d.type = type;
            if (type === "commit") {
                d.id = d["commit_id"];
                d.commit_date = parseTimeEDT(d.commit_date) || parseTimeEST(d.commit_date);
            } else if (type === "bug" || type === "improvement") {
                d.resolved_date = parseTimeEDT(d.resolved_date) || parseTimeEST(d.resolved_date);
                d.created_date = parseTimeEDT(d.created_date) || parseTimeEST(d.created_date);
            }
            allNodes.push(d);
        });
    }


    function addLinkSourceTarget(links, sourceField, targetField, sourceType, targetType) {
        links.forEach(d => {
            d["source"] = d[sourceField];
            d["target"] = d[targetField];
            d["source_type"] = d[sourceType];
            d["target_type"] = d[targetType];
            allLinks.push(d);
        })
    }

    return { 'nodes': allNodes, 'links': allLinks };
}

getData().then(data => {
    setUpDateSelectors(data);
    setUpPrioritySelector("bugPriority", getPriorities(data, "bug"));
    setUpPrioritySelector("impPriority", getPriorities(data, "improvement"));

    d3.select("#radial")
        .datum(data)
        .call(radial);
});


function setUpDateSelectors(data) {
    const ext = d3.extent(data.nodes.filter(d => d.type === "commit"),
        d => d.commit_date ? d.commit_date.getFullYear() : null);
    
    const startDateMonth = document.getElementById("startDateMonth");
    const startDateYear = document.getElementById("startDateYear");

    const endDateMonth = document.getElementById("endDateMonth");
    const endDateYear = document.getElementById("endDateYear");
    
    for (let y of d3.range(ext[0], ext[1] + 1)) {
        startDateYear.appendChild(createOption(y, y));
        endDateYear.appendChild(createOption(y, y));
    }

    const months = ["", "January", "February", "March", "April", "May", "June", "July",
        "August", "September", "October", "November", "December"];

    for(let y of d3.range(1, 13)) {
        startDateMonth.appendChild(createOption(months[y], months[y]));
        endDateMonth.appendChild(createOption(months[y], months[y]));
    }
    
    startDateYear.value = ext[0];
    endDateYear.value = ext[1];

    startDateMonth.value = "January";
    endDateMonth.value = "December";
}

function getPriorities(data, type) {
    return Array.from(new Set(data.nodes.filter(d => d.type === type).map(d => d.priority))).sort();
}

function setUpPrioritySelector(selectorId, priorities) {
    const prioritySelector = document.getElementById(selectorId);

    for (let p of priorities) {
        let text = p.length <= 10 ? p : p.substr(0, 10) + "...";
        prioritySelector.appendChild(createOption(p, text));
    }
    prioritySelector.appendChild(createOption("", ""));
    prioritySelector.value = "";
}

function createOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.text = text;
    return option;
}
