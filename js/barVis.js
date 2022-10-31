/* * * * * * * * * * * * * *
*      class BarVis        *
* * * * * * * * * * * * * */


class BarVis {

    constructor(parentElement, covidData, censusData, descending){

        this.parentElement = parentElement;
        this.covidData = covidData;
        this.censusData = censusData;
        this.displayData = [];
        this.descending = descending;

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis(){
        let vis = this;
        vis.topTenData;
        vis.bottomTenData;

        vis.margin = {top: 20, right: 20, bottom: 20, left: 40};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;
        vis.barwidth = vis.width*1.8;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        vis.barchartArea = vis.svg.append("g")

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            .text('Detail: States vs ' + selectedCategory)
            .attr('transform', `translate(${vis.width / 2}, 10)`)
            .attr('text-anchor', 'middle');

        // tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'barTooltip')


        // init scales
        vis.x = d3.scaleBand().rangeRound([0, vis.width]);
        vis.y = d3.scaleLinear().range([vis.height, 0]);

        // init x & y axis
        vis.xAxis = d3.axisBottom(vis.x)
        vis.yAxis = d3.axisLeft(vis.y);

        //Draw the axis
        vis.barchartArea.append("g").attr("class", "axis x-axis")
                .attr("transform", "translate(0," + (vis.height) + ")")

        vis.barchartArea.append("g").attr("class", "axis y-axis")
                // .attr("transform", "translate(2, 0)")

            //Add text label for axes
            vis.barchartArea.append("text")
                .attr("transform","translate(" + (vis.barwidth-75) + " ," + (vis.height-5) + ")")
                .attr("class", "axis-label")
                .style("text-anchor", "middle")
                .text("State");

        // Finally, add barlabels within own group so they are always positioned on top of bars.
        vis.barlabelgroup = vis.barchartArea.append("g")
            .attr("class", "barlabelgroup")
            .style("z-index", 10)
        //     vis.barchartArea.append("text")
        //         .attr("transform","rotate(-90)")
        //         .attr("y", -30)
        //         .attr("x", 400-vis.height)
        //         .attr("dy", "1em")
        //         .style("text-anchor", "middle")
        //         .text(selectedCategory);
        //
        // }




        this.wrangleData();
    }

    wrangleData(){
        let vis = this
        // Pulling this straight from dataTable.js
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach(row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))
        
        // init final data structure in which both data sets will be merged into
        vis.stateInfo = []

        // merge
        covidDataByState.forEach(state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.censusData.forEach(row => {
                if (row.state === stateName) {
                    population += +row["2020"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach(entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.stateInfo.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum / population * 100),
                    relDeaths: (newDeathsSum / population * 100)
                }
            )
        })
        // Sort and then filter by top 10
        //

        if (vis.descending){
            vis.stateInfo.sort((a,b) => {return b[selectedCategory] - a[selectedCategory]})
        } else {
            vis.stateInfo.sort((a,b) => {return a[selectedCategory] - b[selectedCategory]})
        }

        console.log('final data structure', vis.stateInfo);

        vis.topTenData = vis.stateInfo.slice(0, 10)
        vis.bottomTenData = vis.stateInfo.slice(-10,)

        console.log('final data structure', vis.topTenData);
        console.log('final data structure', vis.bottomTenData);


        if (vis.descending){
            vis.displayData = this.topTenData
            vis.svg.select(".bar-title").text("Top Ten States v. " + selectedCategory)
        }
        else {
            vis.displayData = this.bottomTenData
            vis.svg.select(".bar-title").text("Bottom Ten States v. " + selectedCategory)

        }

        vis.maxRange = d3.max(vis.displayData.map(d=>d[selectedCategory]))
        vis.y.domain([0, vis.maxRange])
        vis.x.domain(vis.displayData.map(d => d.state))
        // vis.yAxis.tickValues([0, vis.maxRange])


        //Define range of axes, by passing in scale function
        var converter = new NameConverter()
        vis.xAxis.tickValues(vis.displayData.map(d => d.state)).tickFormat(x=>converter.getAbbreviation(x));

        vis.yAxis.scale(vis.y)
            .ticks(4)
            .tickFormat(d3.format(".2s"));


        vis.updateVis()

    }

    updateVis(){
        let vis = this;

        console.log('here')

        vis.bars = vis.barchartArea.selectAll("rect")
            .data(vis.displayData, d=>d.state);

        vis.bars.exit().remove();

        vis.bars.enter()
            .append("rect")
            .merge(vis.bars)
            .attr("x", d => 5+vis.x(d.state))
            .attr("class", "valueBars")
            .on('mouseover', function(event, d){
                //Make sure to use a regular function(){} rather than an arrow function so that the keyword this is bound to the actual arc, i.e. the selection.
                d3.select(this)
                    .attr('stroke-width', '1px')
                    .attr('stroke', 'darkgray')
                    .attr('fill', 'rgb(65,192,160)');

                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                     <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
                         <h4><b>${d.state}</b></h4>    
                         <p>${selectedCategory}: ${d[selectedCategory]}</p>                
                     </div>`);

            })
            .on('mouseout', function(d){
                d3.select(this)
                    .attr("stroke", "darkgray")
                    .attr('stroke-width', '1px')
                    .attr("fill", "lightgray")

                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``);
            })
            .transition()
            .duration(400)
            .attr("fill", "lightgray")
            .attr("width", (vis.barwidth-100) / (vis.displayData.length*2))
            .attr("height", d => vis.y(vis.maxRange-d[selectedCategory]))
            .attr("y", d=> vis.height-vis.y(vis.maxRange-d[selectedCategory]))

        ;

        //	Append text label for values
        vis.barlabels = vis.barchartArea.selectAll(".labelBarValue")
            .data(vis.displayData);

        vis.barlabels.exit().remove();

        vis.barlabels.enter()
            .append("text")
            .merge(vis.barlabels)
            .attr("class", "labelBarValue")
            .transition()
            .duration(400)
            .attr("x", d => 15+vis.x(d.state))
            .attr("y", d=> vis.height-vis.y(vis.maxRange-d[selectedCategory])+8)
            .text(d => d3.format(".2s")(d[selectedCategory]))



    //     //Draw the axis
        vis.barchartArea.select(".x-axis")
    //         .attr("transform", "translate(0," + (vis.height) + ")")
            .call(vis.xAxis);
    //
        vis.barchartArea.select(".y-axis")
    //         // .attr("transform", "translate(2, 0)")
            .call(vis.yAxis);
    //
    //     //Add text label for axes
    //     vis.barchartArea.append("text")
    //         .attr("transform","translate(" + (vis.barwidth-50) + " ," + (vis.height-10) + ")")
    //         .style("text-anchor", "middle")
    //         .text("State");
    //
    //     vis.barchartArea.append("text")
    //         .attr("transform","rotate(-90)")
    //         .attr("y", -30)
    //         .attr("x", 400-vis.height)
    //         .attr("dy", "1em")
    //         .style("text-anchor", "middle")
    //         .text(selectedCategory);
    //
    }



}