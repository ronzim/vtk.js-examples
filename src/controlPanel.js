export const controlPanel = `<table> 
<tr>
  <td>Keep orthogonality :</td>
  <td>
    <input type="checkbox" id="checkboxOrthogality" checked>
  </td>
</tr>
<tr>
  <td>Allow rotation :</td>
  <td>
    <input type="checkbox" id="checkboxRotation" checked>
  </td>
</tr>
<tr>
  <td>Allow translation :</td>
  <td>
    <input type="checkbox" id="checkboxTranslation" checked>
  </td>
</tr>
<tr>
  <td>Slab Mode :</td>
  <td>
    <select id="slabMode">
      <option id="slabModeMin">MIN</option>
      <option id="slabModeMax">MAX</option>
      <option id="slabModeMean" selected="selected">MEAN</option>
      <option id="slabModeSum">SUM</option>
    </select>
  </td>
</tr>
<tr>
  <td>Slab Number of Slices :</td>
  <td><input id='slabNumber' type="range" min="1" max="100" step="1" value="1" style="width: 100px;"/></td>
  <td id='slabNumberValue'>1</td>
</tr>
<tr>
  <td>
    <button id="buttonReset">Reset views:</button>
  </td>
</tr>  
</table>`;

// ----------------------------------------------------------------------------
// Define html structure
// ----------------------------------------------------------------------------

const container = document.querySelector("body");
const table = document.createElement("table");
table.setAttribute("id", "table");
container.appendChild(table);

// Define first line that will contains control panel
const trLine0 = document.createElement("tr");
trLine0.setAttribute("id", "line0");
table.appendChild(trLine0);
const controlContainer = document.createElement("div");
trLine0.appendChild(controlContainer);
controlContainer.innerHTML = controlPanel;

const trLine1 = document.createElement("tr");
trLine1.setAttribute("id", "line1");
table.appendChild(trLine1);

const trLine2 = document.createElement("tr");
trLine2.setAttribute("id", "line2");
table.appendChild(trLine2);
