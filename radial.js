function Radial() {
  // based on https://bl.ocks.org/mbostock/7607999
  var diameter = 600;
  var radius = diameter / 2;
  var innerRadius = radius - 10;
  var nodeSize = 5;
  var defaultMsg = "Hover over a node for details.<br />Click on a node to keep it highlighted.";
  var msg = defaultMsg;

  var color = d3.scaleOrdinal().range(d3.schemeCategory10);

  var update;
  var originalData;

  var filtering = {
    startDate: null,
    endDate: null,
    unconnectedNodes: true,
    codePath: "",
    commitAuthor: "",
    commitMsg: "",
    bugAssignee: "",
    bugDescription: "",
    bugSummary: "",
    bugPriority: "",
    impAssignee: "",
    impDescription: "",
    impSummary: "",
    impPriority: "",
    code: true,
    commit: true,
    improvement: true,
    bug: true,
    onlyHighlighted: false
  }

  function match(a, b) {
    return a.toLowerCase().search(b.toLowerCase()) !== -1;
  }

  function filterNodes(d) {
    if (!filtering[d.type] || (filtering.onlyHighlighted && !d.frozen)) {
      return false;
    }

    if (d.type === "code") {
      return match(d.path, filtering.codePath);

    } else if (d.type === "commit") {
      if (!match(d.author, filtering.commitAuthor) ||
        !match(d.message, filtering.commitMsg)) {
        return false;
      }
      if (filtering.startDate && filtering.endDate) {
        return d.commit_date >= filtering.startDate &&
          d.commit_date <= filtering.endDate;
      }

    } else if(d.type === "bug") {
      if (!match(d.priority, filtering.bugPriority) ||
        !match(d.description, filtering.bugDescription) ||
        !match(d.summary, filtering.bugSummary) ||
        (!match(d.assignee, filtering.bugAssignee) &&
          !match(d.assignee_username, filtering.bugAssignee))) {
        return false;
      }
      if (filtering.startDate && filtering.endDate) {
        return d.created_date >= filtering.startDate &&
          d.created_date <= filtering.endDate;
      }

    } else if(d.type === "improvement") {
      if (!match(d.priority, filtering.impPriority) ||
        !match(d.description, filtering.impDescription) ||
        !match(d.summary, filtering.impSummary) ||
        (!match(d.assignee, filtering.impAssignee) &&
          !match(d.assignee_username, filtering.impAssignee))) {
        return false;
      }
      if (filtering.startDate && filtering.endDate) {
        return d.created_date >= filtering.startDate &&
          d.created_date <= filtering.endDate;
      }
    }
    return true;
  }

  var radial = function(selection) {
    selection.each(function(data, i) {

      var svg = selection.append("svg")
        .attr("width", diameter)
        .attr("height", diameter);

      var graph = svg.append("g")
        .attr("transform", "translate("+ radius +","+ radius +")");

      var info = d3.select("#info");
      info.text(defaultMsg);

      var cluster = d3.cluster()
        .size([360, innerRadius]);

      var line = d3.radialLine()
        .curve(d3.curveBundle.beta(0.85))
        .radius(d => d.y)
        .angle(d => { return d.x / 180 * Math.PI});

      var linkGroup = graph.append("g").attr("class", "link_group");
      var nodeGroup = graph.append("g").attr("class", "node_group");

      var original_grouped = d3.nest()
        .key(d => d.type)
        .entries(data.nodes);
      var types = original_grouped.map(d => d.key);

      var legend = graph.append("g")
        .attr("class", "legend_group")
        .attr("transform", d => "translate("+(-radius + 10)+","+ (-radius + 10)+")")
        .selectAll(".legend")
        .data(types)
        .enter().append("g")
        .attr("transform", (d, i) => "translate("+(0)+","+(i*15)+")");

      legend.append("text")
        .text(d => d)
        .attr("font-family", "sans-serif")
        .attr("dy", "0.35em")
        .attr("dx", "0.75em")
        .attr("font-size", "14");
      legend.append("circle")
        .attr("fill", d => color(d))
        .attr("r", nodeSize);


      update = function() {
        var filteredNodes = data.nodes.filter(filterNodes);

        var idToNode = {};
        for (var n of filteredNodes) {
          n.connected = false;
          idToNode[n.id] = n;
        }

        var filteredLinks = [];
        for (var l of data.links) {
          var asource = idToNode[l.source];
          var atarget = idToNode[l.target];

          if (asource && atarget) {
            asource.connected = true;
            atarget.connected = true;
            filteredLinks.push(l);
          }
        }

        if (!filtering.unconnectedNodes) {
          filteredNodes = filteredNodes.filter(d => d.connected);
        }

        var root = {id: "root", children: []};
        var grouped = d3.nest()
          .key(d => d.type)
          .entries(filteredNodes);

        for (var g of grouped) {
          root.children.push({id: g.key, children: g.values})
        }

        root = d3.hierarchy(root);
        cluster(root);
        var idToNode = {};
        for (var c of root.leaves()) {
          idToNode[c.data.id] = c;
        }

        var updatedLinks = [];
        for (var l of filteredLinks) {
          var asource = idToNode[l.source];
          var atarget = idToNode[l.target];
          var a = [asource, atarget];
          a.source = asource;
          a.target = atarget;
          a.source_type = l.source_type;
          a.target_type = l.target_type;
          updatedLinks.push(a);
        }


        var links = linkGroup.selectAll(".radial_link")
          .data(updatedLinks, d => d[0].data.id + "_" + d[1].data.id);
        links.exit().remove();

        links.enter().append("path")
          .attr("class", "radial_link")
          .merge(links)
          .transition()
          .duration(200)
          .attr("d", line);

        var nodes = nodeGroup.selectAll(".radial_node")
          .data(root.leaves(), d => d.data.id);
        nodes.exit().remove(); 

        nodes.enter().append("circle")
          .attr("class", "radial_node")
          .attr("fill", d => color(d.data.type))
          .attr("r", nodeSize)
          .on("mouseover", mouseover)
          .on("mouseout", mouseout)
          .on("click", click)
          .merge(nodes)
          .transition()
          .duration(200)
          .attr("transform", d => "rotate(" + (d.x - 90)  + ") translate(" + d.y + ")");

        if (graph.selectAll(".clicked").size() === 0) {
          graph.selectAll(".frozen").classed("frozen", false);
          msg = defaultMsg;
          info.html(msg);
        }
      }
      update();


      function click(d) {
        graph.selectAll(".radial_node.frozen")
          .classed("frozen", false)
          .each(d => d.data.frozen = false);

        graph.selectAll(".radial_link.frozen").classed("frozen", false);

        if (d3.select(this).classed("clicked")) {
          msg = defaultMsg;
          graph.selectAll(".clicked").classed("clicked", false);

          if (filtering.onlyHighlighted) {
            update();
          }

          return;
        }
        graph.selectAll(".clicked").classed("clicked", false);

        msg = info.html();

        let hnodes = new Set();

        graph.selectAll(".radial_link")
          .filter(function(n) {
            if (n.source === d) {
              hnodes.add(n.target);
              n.target.data.frozen = true;
              return true;
            }
            if (n.target === d) {
              hnodes.add(n.source);
              n.source.data.frozen = true;
              return true;
            }
          })
          .classed("frozen", true);

        graph.selectAll(".radial_node")
          .filter(function(n) {
            return hnodes.has(n);
          })
          .classed("frozen", true);

        d.data.frozen = true; 

        d3.select(this).classed("clicked", true);
        d3.select(this).classed("frozen", true);

        if (filtering.onlyHighlighted) {
          update();
        }

      }

      function mouseover(d) {
        // highlight the edges and nodes that are connected with this node
        d3.select(this).classed("highlight", true);

        let hnodes = new Set();

        graph.selectAll(".radial_link")
          .filter(function(n) {
            if (n.source === d) {
              hnodes.add(n.target);
              return true;
            }
            if (n.target === d) {
              hnodes.add(n.source);
              return true;
            }
            return false;
          })
          .classed("highlight", true);

        graph.selectAll(".radial_node")
          .filter(function(n) {
            return hnodes.has(n);
          })
          .classed("highlight", true);


        // show information about this node
        let dat = d.data;
        if (dat.type === "code") {
          info.html("<strong>Path</strong>: " + dat.path);
        } else if (dat.type === "commit") {
          info.html("<strong>Author</strong>: " + dat.author +
            "<br><br><strong>Commit Date</strong>: " + dat.commit_date +
            "<br><br><strong>Message</strong>: " + dat.message);
        } else if (dat.type === "bug") {
          info.html("<strong>Priority</strong>: " + dat.priority +
            "<br><br><strong>Assignee</strong>: " + dat.assignee + ", " + dat.assignee_username + 
            "<br><br><strong>Status</strong>: " + dat.status +
            "<br><br><strong>Summary</strong>: " + dat.summary +
            "<br><br><strong>Description</strong>: " + dat.description);
        } else if (dat.type === "improvement") {
          info.html("<strong>Priority</strong>: " + dat.priority +
            "<br><br><strong>Assignee</strong>: " + dat.assignee + ", " + dat.assignee_username + 
            "<br><br><strong>Status</strong>: " + dat.status +
            "<br><br><strong>Summary</strong>: " + dat.summary +
            "<br><br><strong>Description</strong>: " + dat.description);
        }
      }

      function mouseout(d) {
        graph.selectAll(".highlight")
          .classed("highlight", false);
        info.html(msg);
      }

    });
  }

  d3.select("#dateButton")
    .on("click", () => {
      const format = d3.timeParse("%B %Y");

      filtering.startDate = format(d3.select("#startDateMonth").property("value")
        + " " + d3.select("#startDateYear").property("value"));

      filtering.endDate = format(d3.select("#endDateMonth").property("value")
        + " " + d3.select("#endDateYear").property("value"));

      update();
    });

  for (let kind of ["code", "commit", "bug", "improvement"]) {
    d3.select("#" + kind + "Check")
      .on("change", function() {
        filtering[kind] = d3.select(this).property("checked");
        update();
      });
  }

  d3.select("#noLinkNodes")
    .on("click", function() {
      filtering.unconnectedNodes = d3.select(this).property("checked");
      update();
    });


  d3.select("#onlyHighCheck")
    .on("click", function() {
      filtering.onlyHighlighted = d3.select(this).property("checked");
      update();
      if (filtering.onlyHighCheck) {
        d3.selectAll('.radial_link:not(.frozen)').remove();
      }
    });


  d3.select("#bugPriority")
    .on("change", () => {
      filtering.bugPriority = d3.select("#bugPriority").property("value");
      update();
    });


  d3.select("#impPriority")
    .on("change", () => {
      filtering.impPriority = d3.select("#impPriority").property("value");
      update();
    });

  d3.select("#clearHighlights")
    .on("click", function() {
      msg = defaultMsg;
      d3.select('#info').html(msg);
      
      d3.selectAll(".clicked").classed("clicked", false);
      
      d3.selectAll(".radial_node.frozen")
        .classed("frozen", false)
        .each(d => d.data.frozen = false);

      d3.selectAll(".radial_link.frozen")
        .classed("frozen", false);

      if (filtering.onlyHighlighted) {
        update();
      }
    });


  connectTextInput("#codePath", "#pathButton", "codePath");
  connectTextInput("#commitAuthor", "#authorButton", "commitAuthor");
  connectTextInput("#commitMsg", "#commitMsgButton", "commitMsg");
  connectTextInput("#bugDescription", "#bugDescriptionButton", "bugDescription");
  connectTextInput("#bugSummary", "#bugSummaryButton", "bugSummary");
  connectTextInput("#bugAssignee", "#bugAssigneeButton", "bugAssignee");
  connectTextInput("#impDescription", "#impDescriptionButton", "impDescription");
  connectTextInput("#impSummary", "#impSummaryButton", "impSummary");
  connectTextInput("#impAssignee", "#impAssigneeButton", "impAssignee");

  function connectTextInput(inputId, buttonId, field) {
    d3.select(buttonId)
      .on("click", () => {
        filtering[field] = d3.select(inputId).property("value");
        update();
      });
    d3.select(inputId)
      .on("keypress", () => {
        if (d3.event.keyCode === 13) {
          filtering[field] = d3.select(inputId).property("value");
          update();
        }
      });
  }

  return radial;
}
