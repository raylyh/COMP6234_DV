// Yu Hong Leung: 2020 Jan 04
// Browser supports ES6
// D3 v5

Promise.all([
    d3.csv("https://gist.githubusercontent.com/raylyh/0f8f96afa5516966ada57c25fa5ee041/raw/136d13e9719077fec8700a4e69f09577db30ed59/england0018.csv", function(d) {
        // data for england waste and recycling rate
        return {
            year: new Date(+d["Year"], 0, 1),
            // store waste in kg
            waste_eng: +d["Total household waste (inc. all recycling)"] * 1000000,
            recycle_eng: +d["Total household recycling, composting and reuse"] * 1000000,
            rRate_eng: +d["Household waste recycling rate"],
            population_eng: +d["Population"]
        };
    }),
    d3.csv("https://gist.githubusercontent.com/raylyh/f42d5f859d6508d6f140b3695b6365d2/raw/6de7e945d5fa9dc802b0f9a55a54fefe182728d9/world_waste.csv", function(d) {
        // data for world waste data
        return {
            iso3c: d["iso3c"],
            country_name: d["country_name"],
            gdp: +d["gdp"],
            region_id: d["region_id"],
            populaton: +d["population_population_number_of_people"],
            total_waste: +d["total_msw_total_msw_generated_tons_year"] * 1000, // in kg
            year_source: +d["year"],
            source: d["source"]
        };
    }),
    d3.csv("https://gist.githubusercontent.com/raylyh/91b07d5f6c01f5ed4f9d749b36c94232/raw/f2663b27fc131362d23515b5fb7aa321b177ee10/uk_population.csv", function(d) {
        // data for england and the uk population
        return {
            year_str: d["Code/Year"],
            year: new Date(d["Code/Year"].slice(4), 0, 1),
            population_eng: +d["ENGLAND"],
            population_uk: +d["UNITED KINGDOM"]
        }
    }),
    // data for world map
    d3.json("https://gist.githubusercontent.com/raylyh/807f50f38e25a091c2d9f968661144d5/raw/cd79321be7b2ba561a9c56c61fc6b6ba083ee222/world.geojson"),
    d3.csv("https://gist.githubusercontent.com/raylyh/cce2a9008ce10b2b40e0fdcf360d0c89/raw/f89ba7934d3f6fa238e41303f805d5ce471da323/breakdown2018.csv", function(d) {
        // data for waste breakdown in recycling stream in the uk
        return {
            name: d["name"],
            group: d["parent"],
            value: +d["value"]
        }
    })
]).then(function(files) {
    let data_england = files[0];
    let data_world = files[1];
    let population = files[2];
    let map_world = files[3];
    let breakdown2018 = files[4];

    // calculate waste per capita (kg) in ENGLAND
    data_england = data_england.map(
        d => ({...d, waste_per_capita: d.waste_eng / d.population_eng, recycling_per_capita: d.recycle_eng / d.population_eng})
    );
    data_england.sort((a, b) => b.year - a.year);

    // calculate waste per capita (kg) per that year in the world
    data_world = data_world.map(d => ({...d, waste_per_capita: d.total_waste / d.populaton}));
    // sort the data in descending order of waste per capita
    /*
    data_world.sort(function(a, b) {
        return b.waste_per_capita - a.waste_per_capita;
    })
    */

    // print the data
    console.log(data_england);
    console.log(data_world);
    console.log(population);
    console.log(breakdown2018);


    // map visualisation on world waste
    {
        let margin = { top: 50, right: 100, bottom: 50, left: 100};
        let width = 800;
        let height = 450;

        let svg = d3.select("#worldmap")
            .select("#map")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom()
                .scaleExtent([0.9, 3])
                .translateExtent([[-100, -100], [width+100, height+100]])
                .on("zoom", () => {
                    svg.attr("transform", d3.event.transform)
                }))
            .append("g");

        let tooltip = d3.select("#tooltip")
                .append("div")
                .style("opacity", 0)
                .attr("class", "tooltip")
                .style("background-color", "white")
                .style("border", "solid")
                .style("border-width", "2px")
                .style("border-radius", "5px")
                .style("padding", "5px")
                .style("position", "absolute");

        let mouse_over = function (d) {
            tooltip.style("opacity", 1);
            d3.select(this).raise()
                .style("stroke", "black")
                .style("stroke-width", "1px");
        };

        let mouse_move = function (d) {
            tooltip.html(`Country: ${map.get(d.properties.A3)[0]}
                <br>Waste (kg/capita/year): ${d3.format(".2f")(map.get(d.properties.A3)[1])}`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY) + "px")
        };

        let mouse_leave = function (d) {
            tooltip.style("opacity", 0);
            d3.select(this)
                .style("stroke", "#FFF")
                .style("stroke-width", "0.3px");
        };

        let projection = d3.geoNaturalEarth1()
            // .scale(width / 2 / Math.PI)
            .translate([width / 2 - 50, height / 2]);

        let map = d3.map();
        // set the data for the map
        map_world.features.forEach(d => map.set(d.properties.A3, [d.properties.A3, "Unavailable"]));
        data_world.forEach(d => map.set(d.iso3c, [d.country_name, d.waste_per_capita]));

        let scale_color = d3.scaleThreshold()
            .domain([
                200, 400, 600, 800
            ])
            .range(["#4E9583", "#80AF58", "#F7AA37", "#F76B38", "#F53B27"]);
            // 0 <= x < 200: color1
            // 200 <= x < 400: color 2
            // .range(["#84CABF", "#FEE08B", "#FF9326"])
            // .interpolate(d3.interpolateHcl);

        svg.selectAll("path")
            .data(map_world.features)
            .enter()
            .append("path")
            .attr("d", d3.geoPath().projection(projection))
            .attr("fill", function(d) {
                d.total = map.get(d.properties.A3);
                // console.log(d.total);
                if (d.total[1] === "Unavailable") {
                    return "#808080";
                } else {
                    return scale_color(d.total[1]);
                }
            })
            .attr("class", "country")
            .style("stroke", "#FFF")
            .style("stroke-width", "0.3px")
            .on("mouseover", mouse_over)
            .on("mousemove", mouse_move)
            .on("mouseleave", mouse_leave);

        projection.fitSize([width, height], map);

        // legend for the map
        let svg_legend = d3.select("#worldmap")
            .select("#legend")
            .attr("width", 400)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(0,${height / 4})`);

        let keys = ["0 - 199 kg", "200 - 399 kg", "400 - 599 kg", "600 - 799 kg", "800 kg or above", "Data unavailable"];
        let color = d3.scaleOrdinal()
            .domain(keys)
            .range(["#4E9583", "#80AF58", "#F7AA37", "#F76B38", "#F53B27", "#808080"]);

        svg_legend.selectAll("legenddots")
            .data(keys)
            .enter()
            .append("circle")
            .attr("class", "legend")
            .attr("cx", 50)
            .attr("cy", (d, i) => {return i * 25})
            .attr("r", 7)
            .style("fill", d => color(d));

        svg_legend.selectAll("legendlabels")
            .data(keys)
            .enter()
            .append("text")
            .attr("class", "legend")
            .attr("x", 70)
            .attr("y", (d, i) => {return i * 25})
            .attr("dy", "0.75ex")
            .style("fill", d => color(d))
            .text(d => d)
            .attr("text-anchor", "left")
            .style("dominant-baseline", "baseline");

        // source for the chart's data
        d3.select("#worldmap")
            .select("#source")
            .attr("width", width)
            .attr("height", 30)
            .append("text")
            .attr("x", width)
            .attr("y", 30)
            .attr("dy", "-1em")
            .attr("class", "source")
            .text("Source: World Bank's What a Waste Global Database");
    }


    // visualisation on UK's / England's waste_eng
    {
        let margin = { top: 50, right: 400, bottom: 100, left: 50 };
        let width = 800;
        let height = 500;

        let svg = d3.select("#viz_eng")
            .select("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${0},${margin.top})`);

        // scale for x and y
        let scale_x = d3.scaleTime()
            .domain([
                d3.min(data_england, d => d.year) - 3.6e+10,
                d3.max(data_england, d => d.year)
            ])
            .range([0, width]);

        let scale_y = d3.scaleLinear()
            .domain([
                0,
                d3.max(data_england, d => d.waste_per_capita) * 1.2
            ])
            .range([height, 0]);

        // line for waste per capita
        let line_waste = d3.line()
            .x(d => scale_x(d.year))
            .y(d => scale_y(d.waste_per_capita));

        // line for recycling per capita
        let line_recycle = d3.line()
            .x(d => scale_x(d.year))
            .y(d => scale_y(d.recycling_per_capita));

        // x axis
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(g => {
                g.call(d3.axisBottom(scale_x));
                g.select(".domain").remove();
            });

        // label for x axis
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom / 2)
            .style("text-anchor", "middle")
            .text("Year");

        // y axis
        svg.append("g")
            .call(g => {
                g.call(d3.axisRight(scale_y).tickSize(width + margin.left));
                g.select(".domain").remove();
                g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "#777").attr("stroke-dasharray", "2,2");
                g.selectAll(".tick text").attr("x", 4).attr("dy", -4);
            });

        // label for y axis
        svg.append("text")
            // .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", 0)
            .attr("dy", "-1em")
            .style("text-anchor", "start")
            .text("kg per capita");

        // line and circles for waste per capita
        svg.append("path")
            .datum(data_england)
            .attr("d", line_waste)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#FF9326")
            .attr("stroke-width", 2);

        svg.selectAll("wcircle")
            .data(data_england)
            .enter()
            .append("circle")
            .attr("cx", d => scale_x(d.year))
            .attr("cy", d => scale_y(d.waste_per_capita))
            .attr("r", 5)
            .style("fill", "#FF9326")
            .attr("stroke", "black");

        // line and circles for recycling per capita
        svg.append("path")
            .datum(data_england)
            .attr("d", line_recycle)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#4E9583")
            .attr("stroke-width", 2);

        svg.selectAll("rcircle")
            .data(data_england)
            .enter()
            .append("circle")
            .attr("cx", d => scale_x(d.year))
            .attr("cy", d => scale_y(d.recycling_per_capita))
            .attr("r", 5)
            .style("fill", "#4E9583")
            .attr("stroke", "black");

        // legend
        let legend = svg.append("g")
            .attr("transform", `translate(${width - margin.left / 2},${height / 2})`);

        let keys = ["Total Household Waste", "Total Household Recycling"];
        let color = d3.scaleOrdinal()
            .domain(keys)
            .range(["#FF9326", "#4E9583"]);

        legend.selectAll("legenddots")
            .data(keys)
            .enter()
            .append("circle")
            .attr("class", "legend")
            .attr("cx", 100)
            .attr("cy", (d, i) => {return i * 25})
            .attr("r", 7)
            .style("fill", d => color(d));

        legend.selectAll("legendlabels")
            .data(keys)
            .enter()
            .append("text")
            .attr("class", "legend")
            .attr("x", 120)
            .attr("y", (d, i) => {return i * 25})
            .attr("dy", "0.75ex")
            .style("fill", d => color(d))
            .text(d => d)
            .attr("text-anchor", "left")
            .style("dominant-baseline", "baseline");


        // source for the chart's data
        svg.append("text")
            .attr("x", width + margin.left)
            .attr("y", height + margin.bottom)
            .attr("dy", "-1em")
            .attr("class", "source")
            .text(`Source: WasteDataFlow,
                Department for Environment, Food and Rural Affairs`);
    }
    {
        // second visualisation on england
        let margin = { top: 50, right: 100, bottom: 100, left: 50 };
        let width = 800;
        let height = 500;

        let svg = d3.select("#viz_recycle")
            .select('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${0},${margin.top})`);

        // scale for x and y
        let scale_x = d3.scaleTime()
            .domain([
                d3.min(data_england, d => d.year) - 3.6e+10,
                d3.max(data_england, d => d.year)
            ])
            .range([0, width]);

        let scale_y = d3.scaleLinear()
            .domain([
                0,
                0.55
            ])
            .range([height, 0]);

        console.log(scale_x);
        console.log(scale_y);

        let line = d3.line()
            .x(d => scale_x(d.year))
            .y(d => scale_y(d.rRate_eng));

        svg.append("path")
            .datum(data_england)
            .attr("d", line)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#84CABF")
            .attr("stroke-width", 2);

        svg.selectAll("rrcircle")
            .data(data_england)
            .enter()
            .append("circle")
            .attr("cx", d => scale_x(d.year))
            .attr("cy", d => scale_y(d.rRate_eng))
            .attr("r", 5)
            .style("fill", "#84CABF")
            .attr("stroke", "black");

        // x axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(g => {
                g.call(d3.axisBottom(scale_x));
                g.select(".domain").remove();
            });

        // label for x axis
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom / 2)
            .style("text-anchor", "middle")
            .text("Year");

        // y axis
        svg.append("g")
            .call(g => {
                g.call(d3.axisRight(scale_y)
                    .tickSize(width + margin.right / 2)
                    .tickFormat(d => {
                        return d3.format("~%")(d);
                    })
                );
                g.select(".domain").remove();
                g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "#777").attr("stroke-dasharray", "2,2");
                g.selectAll(".tick text").attr("x", 4).attr("dy", -4);
            });

        // label for y axis
        svg.append("text")
            // .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", 0)
            .attr("dy", "-2em")
            .style("text-anchor", "start")
            .text("Household waste recycling rate");

        // source for the chart
        svg.append("text")
            .attr("x", width + margin.left)
            .attr("y", height + margin.bottom)
            .attr("dy", "-1em")
            .attr("class", "source")
            .text(`Source: Department for Environment, Food and Rural Affairs`);
    }
    {
        // viz on breakdown of 2018 England Waste
        let margin = {top: 50, right: 50, bottom: 50, left: 150};
        let width = 800 - margin.left;
        let height = 600;

        let svg = d3.select("#viz_breakdown")
            .select("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left+10},0)`)

        console.log(d3.max(breakdown2018, d=>d.value));
        let scale_x = d3.scaleLinear()
            .domain([
                0,
                4000
            ])
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(scale_x));

        // label for x axis
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom)
            .style("text-anchor", "middle")
            .text("Thousand tonnes");

        let scale_y = d3.scaleBand()
            .domain(breakdown2018.map(d => d.name))
            .range([0, height])
            .padding(1);

        svg.append("g")
            .call(d3.axisLeft(scale_y).tickSize(0))
            .attr("font-size", "12px");

        var scale_color = d3.scaleOrdinal()
            .domain(["Dry recycling", "Organic recycling", "Residual waste"])
            .range(["#3b3730", "#4E9583", "#c49d00"]);

        svg.selectAll("mmmmline")
            .data(breakdown2018)
            .enter()
            .append("line")
            .attr("x1", d => scale_x(d.value))
            .attr("x2", scale_x(0))
            .attr("y1", d => scale_y(d.name))
            .attr("y2", d => scale_y(d.name))
            .attr("stroke", d => scale_color(d.group))
            .attr("stroke-width", "2px");

        svg.selectAll("rcircle")
            .data(breakdown2018)
            .enter()
            .append("circle")
            .attr("cx", d => scale_x(d.value))
            .attr("cy", d => scale_y(d.name))
            .attr("r", 7)
            .style("fill", d => scale_color(d.group))
            .attr("stroke", "black");

        // source for the chart
        svg.append("text")
            .attr("x", width)
            .attr("y", height + margin.bottom * 2)
            .attr("dy", "-1em")
            .attr("class", "source")
            .text(`Source: Department for Environment, Food and Rural Affairs`);

    }
}).catch(function(error) {
    console.log(error)
});
