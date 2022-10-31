/* * * * * * * * * * * * * *
*          MapVis          *
* * * * * * * * * * * * * */


class MapVis {

    constructor(parentElement, covidData, usaData, censusData) {
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;  // usadata has element state, census..., state.value array has key/value pairs with keys = ['new_case'] or ['new_death']
        this.censusData = censusData;
        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.color = d3.scaleLinear().range(["white", "steelblue"]);

        this.initVis()
    }



    initVis() {
        let vis = this

        vis.margin = {top: 20, right: 20, bottom: 20, left: 20};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select(`#${vis.parentElement}`)
            .append("svg")
            .attr("width", vis.width)
            .attr("height", vis.height)
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title')
            .attr('id', 'map-title')
            .append('text')
            .text('Total Covid Cases by State')
            .attr('transform', `translate(${vis.width / 2}, 20)`)
            .attr('text-anchor', 'middle');


        // Draw USA - states in transparent fill
        // create a projection
        vis.projection = d3.geoAlbers()// d3.geoOrthographic() //
            .translate([vis.width / 2, vis.height / 2])
            .scale(vis.width*1.35)


        // define a geo generator and pass your projection to it
        vis.path = d3.geoPath()
            .projection(vis.projection);

        // convert your topojson data into geojson data structure
        vis.usa = topojson.feature(vis.usaData, vis.usaData.objects.states).features

        // create tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'mapTooltip')

        // draw states
        vis.states = vis.svg.selectAll(".state")
            .data(vis.usa)
            .enter().append("path")
            .attr('class', 'state')
            .attr("d", vis.path)
            .attr("fill", "gray")
            .attr("id", d => d.properties.name)


        // draw legend box
        vis.legend = vis.svg.append("g")
            .attr('class', 'legend')
            .attr('transform', `translate(${vis.width / 4-100}, ${vis.height - 75})`)
            .attr('width', 200)
            .attr('height', 30)


        vis.legendaxisgroup = vis.legend.append("g")
            .attr('class', 'legendaxisgroup')


        vis.legendscale = d3.scaleLinear()
            .range([0,120]) // fixed 4 color legend box of width 30px each

        vis.xAxis = d3.axisBottom(vis.legendscale)
            .ticks(1)
            .tickFormat(x => `${d3.format(".2s")(x)}`);

        // wrangleData
        vis.wrangleData([])
    }



    wrangleData(selectedTimeRange) {
        let vis = this;



        // check out the data
        // console.log("coviddata:" + vis.covidData)
        // console.log("usadata" + vis.usaData)
        // console.log("censusdata" + vis.censusData)
        console.log(selectedTimeRange, selectedCategory)

        // first, filter according to selectedTimeRange, init empty array
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

        // have a look
        // console.log(covidDataByState)

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

        vis.maxRange = 0;

        // associate with state name as key, for accessing in tooltip.  could have used map()
        vis.stateInfo.forEach(d => {
            vis.displayData[d.state] = d
            if (d[selectedCategory] > vis.maxRange) {
                vis.maxRange = d[selectedCategory];
            }
        })

        console.log(vis.maxRange)

        vis.color.domain([0, vis.maxRange])
        vis.legendscale.domain([0, vis.maxRange])
        vis.xAxis.tickValues([0, vis.maxRange])



        console.log('final data structure for stateInfo', vis.stateInfo);
        console.log('final data structure for displayData', vis.displayData);


        vis.updateVis()

    }



    updateVis() {

        let vis = this;
        //
        // console.log(vis.displayData["Montana"].absCases)
        // var map = d3.map(vis.stateInfo, d=>d.state)
        // console.log(map)
        console.log("selected category: "+ selectedCategory)

        vis.states
            .attr("fill", function(d) {

                if (vis.displayData[d.properties.name] == undefined) {
                    return "gray"
                }
                else {return vis.color(vis.displayData[d.properties.name][selectedCategory])}
            })
            .attr("stroke", "darkgray")
            .attr("stroke-width", 1)
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
                         <h4><b>${d.properties.name}</b></h4>    
                         <p>Population: ${vis.displayData[d.properties.name].population} 
                         <br>Cases (absolute): ${(vis.displayData[d.properties.name].absCases)}
                         <br>Deaths (absolute): ${(vis.displayData[d.properties.name].absDeaths)} 
                         <br>Cases (relative): ${d3.format(".2r")(vis.displayData[d.properties.name].relCases)}%
                         <br>Deaths (relative): ${d3.format(".1r")(vis.displayData[d.properties.name].relDeaths)}%</br> 
                         
                                           
                     </div>`);

            })
            .on('mouseout', function(event, d){
                d3.select(this)
                    .attr("stroke", "darkgray")
                    .attr('stroke-width', '1px')
                    .attr("fill", function(d) {

                        if (vis.displayData[d.properties.name] == undefined) {
                            return "gray"
                        }
                        else {return vis.color(vis.displayData[d.properties.name][selectedCategory])}
                    })


                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``);
            });

            // bind data to legend
            vis.legendaxisgroup.selectAll("rect")
                .data([0,30,60,90])
                .enter()
                .append("rect")
                .attr("x", function(d,i){return i*30})
                .attr("y", 0)
                .attr("width", 30)
                .attr("height", 10)
                .attr("fill", d => vis.color(vis.legendscale.invert(d)))

            vis.legendaxisgroup.call(vis.xAxis)



    }
}
