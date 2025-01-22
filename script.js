async function fetchGitHubData(username = "YOUR_GITHUB_USERNAME") {
    const token = 'YOUR_GITHUB_TOKEN';

    const query = `
        query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    totalContributions
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                        }
                    }
                }
            }
        }
        }
    `;

    try {
        const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables: { username }
        })
        });

        const json = await response.json();
        const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
        
        return weeks.flatMap(week => 
        week.contributionDays.map(day => ({
            date: day.date,
            contributionCount: day.contributionCount
        }))
        );
    } catch (error) {
        console.error('Error fetching GitHub data:', error);
    }
}

function getColorForContributions(count) {
  if (count === 0) return "#ebedf0";
  if (count <= 3) return "#9be9a8";
  if (count <= 6) return "#40c463";
  if (count <= 9) return "#30a14e";
  return "#216e39";
}

async function renderCalendar() {
    const data = await fetchGitHubData();

    const fixedWidth = 700; // Fixed width for the graph
    const cellSize = 10.5;
    const cellPadding = 2;
    const weekCount = 53;
    const dayCount = 7;
    const labelWidth = 30;

    const width = fixedWidth;
    const height = (cellSize + cellPadding) * dayCount + 70;

    const svg = d3.select("#contribution-calendar")
        .html("") // Clear any existing SVG content
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const days = ['Mon', 'Wed', 'Fri'];
    svg.selectAll(".day-label")
        .data(days)
        .enter()
        .append("text")
        .attr("class", "day-label")
        .attr("x", labelWidth - 5)
        .attr("y", (d, i) => (cellSize + cellPadding) * (i * 2 + 1) + cellSize + 30)
        .attr("text-anchor", "end")
        .text(d => d);

    const monthPositions = data.reduce((acc, d, i) => {
        const date = new Date(d.date);
        const month = date.toLocaleString('default', { month: 'short' });

        if (date.getDate() === 1 && !acc[month]) {
            const weekIndex = Math.floor(i / 7);
            const xPosition = (weekIndex * (cellSize + cellPadding)) + labelWidth;

            if (xPosition < width - 25) {
                acc[month] = xPosition;
            }
        }
        return acc;
    }, {});

    svg.selectAll(".month-label")
        .data(Object.entries(monthPositions))
        .enter()
        .append("text")
        .attr("class", "month-label")
        .attr("x", d => d[1])
        .attr("y", 20)
        .text(d => d[0].substring(0, 3));

    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    svg.selectAll(".contribution-cell")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "contribution-cell")
        .attr("x", (d, i) => (Math.floor(i / 7) * (cellSize + cellPadding)) + labelWidth)
        .attr("y", (d, i) => ((i % 7) * (cellSize + cellPadding)) + 30)
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("rx", 2)
        .attr("fill", d => getColorForContributions(d.contributionCount))
        .on("mouseover", function (event, d) {
            if (isTouchDevice) return;

            const date = new Date(d.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            tooltip.transition()
                .duration(200)
                .style("opacity", 1);

            tooltip.html(`${formattedDate}<br>${d.contributionCount} contributions`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            if (isTouchDevice) return;
            
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    const legendData = [0, 3, 6, 9, 12];
    const legendWidth = cellSize;
    const legendX = width - (legendData.length * (legendWidth + 5)) + labelWidth;

    const legend = svg.append("g")
        .attr("transform", `translate(${legendX - 70}, ${height - 15})`);

    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * (legendWidth + 5))
        .attr("width", legendWidth)
        .attr("height", legendWidth)
        .attr("rx", 2)
        .attr("fill", d => getColorForContributions(d));

    legend.append("text")
        .attr("class", "legend-label")
        .attr("x", -35)
        .attr("y", legendWidth - 1)
        .text("Less");

    legend.append("text")
        .attr("class", "legend-label")
        .attr("x", legendData.length * (legendWidth + 5) + 5)
        .attr("y", legendWidth - 1)
        .text("More");
}

window.addEventListener("resize", renderCalendar);

renderCalendar();