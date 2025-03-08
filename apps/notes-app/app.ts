interface Point {
  id: string;
  text: string;
  links: string[];
  collapsed: boolean;
}

interface Scene {
  id: string;
  text: string;
  collapsed: boolean;
  points: Point[];
}

interface Chapter {
  id: string;
  text: string;
  collapsed: boolean;
  points: Point[];
  scenes: Scene[];
}

interface Act {
  id: string;
  text: string;
  collapsed: boolean;
  points: Point[];
  chapters: Chapter[];
}

interface NotesData {
  acts: Act[];
}

let data: NotesData = loadData();

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function loadData(): NotesData {
  const stored = localStorage.getItem('notesData');
  return stored ? JSON.parse(stored) : { acts: [] };
}

function saveData() {
  localStorage.setItem('notesData', JSON.stringify(data));
}

function toggleCollapse(id: string, type: 'act' | 'chapter' | 'scene' | 'point') {
  if (type === 'act') {
    data.acts.forEach(act => {
      if (act.id === id) act.collapsed = !act.collapsed;
    });
  } else if (type === 'chapter') {
    data.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        if (chapter.id === id) chapter.collapsed = !chapter.collapsed;
      });
    });
  } else if (type === 'scene') {
    data.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        chapter.scenes.forEach(scene => {
          if (scene.id === id) scene.collapsed = !scene.collapsed;
        });
      });
    });
  } else if (type === 'point') {
    data.acts.forEach(act => {
      act.points.forEach(point => {
        if (point.id === id) point.collapsed = !point.collapsed;
      });
      act.chapters.forEach(chapter => {
        chapter.points.forEach(point => {
          if (point.id === id) point.collapsed = !point.collapsed;
        });
        chapter.scenes.forEach(scene => {
          scene.points.forEach(point => {
            if (point.id === id) point.collapsed = !point.collapsed;
          });
        });
      });
    });
  }
  saveData();
  render();
}

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  data.acts.forEach(act => {
    const actEl = document.createElement('div');
    actEl.className = 'act';

    // Act header using only DOM methods
    const actHeader = document.createElement('h2');
    actHeader.appendChild(document.createTextNode('Act: '));
    const actInput = document.createElement('input');
    actInput.value = act.text;
    actInput.style.width = '200px';
    actInput.onchange = () => updateText(act.id, actInput.value, 'act');
    actHeader.appendChild(actInput);
    const actToggleBtn = document.createElement('button');
    actToggleBtn.innerText = act.collapsed ? '>' : '<';
    actToggleBtn.onclick = () => toggleCollapse(act.id, 'act');
    actHeader.appendChild(actToggleBtn);
    actEl.appendChild(actHeader);

    if (!act.collapsed) {
      // Delete Act button (only if empty)
      if (act.points.length === 0 && act.chapters.length === 0) {
        const delBtn = document.createElement('button');
        delBtn.innerText = 'X';
        delBtn.onclick = () => deleteAct(act.id);
        actEl.appendChild(delBtn);
      }
	}
    // Render Act-level points
    act.points.forEach(point => {
      actEl.appendChild(renderPoint(point));
    });
    if (!act.collapsed) {
      const addPointBtnAct = document.createElement('button');
      addPointBtnAct.innerText = 'Add Act Point';
      addPointBtnAct.onclick = () => {
        act.points.push({ id: generateId(), text: 'New point', links: [], collapsed: false });
        saveData();
        render();
      };
      actEl.appendChild(addPointBtnAct);

      // Button to add Chapter
      const addChapterBtn = document.createElement('button');
      addChapterBtn.innerText = 'Add Chapter';
      addChapterBtn.onclick = () => addChapter(act.id);
      actEl.appendChild(addChapterBtn);
	}
      // Render Chapters
      act.chapters.forEach(chapter => {
        const chapterEl = document.createElement('div');
        chapterEl.className = 'chapter';
		
		const chapterAlways = document.createElement('div');
        chapterAlways.className = 'chapterAlways';

        const chapterHeader = document.createElement('h3');
        chapterHeader.appendChild(document.createTextNode('Chapter: '));
        const chapterInput = document.createElement('input');
        chapterInput.value = chapter.text;
        chapterInput.style.width = '200px';
        chapterInput.onchange = () => updateText(chapter.id, chapterInput.value, 'chapter');
        const chapterToggleBtn = document.createElement('button');
        chapterToggleBtn.innerText = chapter.collapsed ? '>' : '<';
        chapterToggleBtn.onclick = () => toggleCollapse(chapter.id, 'chapter');
        chapterAlways.appendChild(chapterToggleBtn);
        chapterAlways.appendChild(chapterHeader);
        chapterAlways.appendChild(chapterInput);
		chapterEl.appendChild(chapterAlways);

        if (!chapter.collapsed) {
          // Delete Chapter button (only if empty)
          if (chapter.points.length === 0 && chapter.scenes.length === 0) {
            const delBtnChap = document.createElement('button');
            delBtnChap.innerText = 'X';
            delBtnChap.onclick = () => deleteChapter(chapter.id);
            chapterEl.appendChild(delBtnChap);
          }
		}
        // Render Chapter-level points
        chapter.points.forEach(point => {
          chapterEl.appendChild(renderPoint(point));
        });
        if (!chapter.collapsed) {
          const addPointBtnChap = document.createElement('button');
          addPointBtnChap.innerText = 'Add Chapter Point';
          addPointBtnChap.onclick = () => {
            chapter.points.push({ id: generateId(), text: 'New point', links: [], collapsed: false });
            saveData();
            render();
          };
          chapterEl.appendChild(addPointBtnChap);

          // Button to add Scene
          const addSceneBtn = document.createElement('button');
          addSceneBtn.innerText = 'Add Scene';
          addSceneBtn.onclick = () => addScene(chapter.id);
          chapterEl.appendChild(addSceneBtn);
		}

          // Render Scenes
          chapter.scenes.forEach(scene => {
            const sceneEl = document.createElement('div');
            sceneEl.className = 'scene';
			
			const sceneAlways = document.createElement('div');
            sceneAlways.className = 'sceneAlways';

            const sceneHeader = document.createElement('h4');
            sceneHeader.appendChild(document.createTextNode('Scene: '));
            const sceneInput = document.createElement('input');
            sceneInput.value = scene.text;
            sceneInput.style.width = '200px';
            sceneInput.onchange = () => updateText(scene.id, sceneInput.value, 'scene');
            const sceneToggleBtn = document.createElement('button');
            sceneToggleBtn.innerText = scene.collapsed ? '>' : '<';
            sceneToggleBtn.onclick = () => toggleCollapse(scene.id, 'scene');
            sceneAlways.appendChild(sceneToggleBtn);
            sceneAlways.appendChild(sceneHeader);
            sceneAlways.appendChild(sceneInput);
			
			sceneEl.appendChild(sceneAlways);

            if (!scene.collapsed) {
              // Delete Scene button (only if empty)
              if (scene.points.length === 0) {
                const delBtnScene = document.createElement('button');
                delBtnScene.innerText = 'X';
                delBtnScene.onclick = () => deleteScene(scene.id);
                sceneEl.appendChild(delBtnScene);
              }
			}
			// Render Scene-level points
			scene.points.forEach(point => {
			  sceneEl.appendChild(renderPoint(point));
			});
            if (!scene.collapsed) {
              const addPointBtnScene = document.createElement('button');
              addPointBtnScene.innerText = 'Add Scene Point';
              addPointBtnScene.onclick = () => {
                scene.points.push({ id: generateId(), text: 'New point', links: [], collapsed: false });
                saveData();
                render();
              };
              sceneEl.appendChild(addPointBtnScene);
            }
            chapterEl.appendChild(sceneEl);
          });
        actEl.appendChild(chapterEl);
      });
    app.appendChild(actEl);
  });
}

function renderPoint(point: Point): HTMLElement {
  const pointEl = document.createElement('div');
  pointEl.className = 'point';

  // Toggle button for point collapse/expand
  const toggleBtn = document.createElement('button');
  toggleBtn.innerText = point.collapsed ? '>' : '<';
  toggleBtn.onclick = () => toggleCollapse(point.id, 'point');
  pointEl.appendChild(toggleBtn);
  
  const pointTextSmall = document.createElement('div');
  pointTextSmall.className = 'pointTextSmall';

  if (point.collapsed) {
    // Collapsed view: show only summary with text and links
	pointTextSmall.appendChild(document.createTextNode(`ID: ${point.id} Point: `));
    pointEl.appendChild(pointTextSmall);
    const pointTextLarge = document.createElement('div');
    pointTextLarge.className = 'pointTextLarge';
    pointTextLarge.appendChild(document.createTextNode(`${point.text} `));
	pointEl.appendChild(pointTextLarge);
    point.links.forEach(linkId => {
      const linkSpan = document.createElement('span');
      linkSpan.className = 'link';
      linkSpan.innerText = `[Link to ${linkId}]`;
      linkSpan.onclick = () => highlightPoint(linkId);
      pointEl.appendChild(linkSpan);
    });
  } else {
    // Expanded view: full controls with textarea, delete, and link buttons.
    const headerDiv = document.createElement('div');
	pointTextSmall.appendChild(document.createTextNode(`ID: ${point.id} `));
    headerDiv.appendChild(pointTextSmall);
    const textArea = document.createElement('textarea');
    textArea.value = point.text;
    textArea.style.width = '200px';
    textArea.style.height = '80px';
    textArea.style.fontSize = '16px';
    textArea.onchange = () => updatePointText(point.id, textArea.value);
    pointEl.appendChild(textArea);
    pointEl.appendChild(headerDiv);

    const delBtnPoint = document.createElement('button');
    delBtnPoint.innerText = 'X';
    delBtnPoint.onclick = () => deletePoint(point.id);
    pointEl.appendChild(delBtnPoint);

    point.links.forEach(linkId => {
      const linkSpan = document.createElement('span');
      linkSpan.className = 'link';
      linkSpan.innerText = `[Link to ${linkId}]`;
      linkSpan.onclick = () => highlightPoint(linkId);
      pointEl.appendChild(linkSpan);
    });

    const linkBtn = document.createElement('button');
    linkBtn.innerText = 'Link Point';
    linkBtn.onclick = () => {
      const otherId = prompt("Enter ID of point to link:");
      if (otherId && otherId !== point.id) {
        addLink(point.id, otherId);
        saveData();
        render();
      }
    };
    pointEl.appendChild(linkBtn);
  }
  return pointEl;
}

function addLink(id1: string, id2: string) {
  function addToPoint(point: Point) {
    if (point.id === id1 && point.links.indexOf(id2) === -1) {
      point.links.push(id2);
    }
    if (point.id === id2 && point.links.indexOf(id1) === -1) {
      point.links.push(id1);
    }
  }
  data.acts.forEach(act => {
    act.points.forEach(addToPoint);
    act.chapters.forEach(chapter => {
      chapter.points.forEach(addToPoint);
      chapter.scenes.forEach(scene => {
        scene.points.forEach(addToPoint);
      });
    });
  });
}

function updateText(id: string, newText: string, type: 'act' | 'chapter' | 'scene') {
  if (type === 'act') {
    data.acts.forEach(act => { if (act.id === id) act.text = newText; });
  } else if (type === 'chapter') {
    data.acts.forEach(act => {
      act.chapters.forEach(chapter => { if (chapter.id === id) chapter.text = newText; });
    });
  } else if (type === 'scene') {
    data.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        chapter.scenes.forEach(scene => { if (scene.id === id) scene.text = newText; });
      });
    });
  }
  saveData();
}

function updatePointText(id: string, newText: string) {
  function update(point: Point) {
    if (point.id === id) point.text = newText;
  }
  data.acts.forEach(act => {
    act.points.forEach(update);
    act.chapters.forEach(chapter => {
      chapter.points.forEach(update);
      chapter.scenes.forEach(scene => {
        scene.points.forEach(update);
      });
    });
  });
  saveData();
}

function highlightPoint(pointId: string) {
  let foundText = "";
  function check(point: Point) {
    if (point.id === pointId) foundText = point.text;
  }
  data.acts.forEach(act => {
    act.points.forEach(check);
    act.chapters.forEach(chapter => {
      chapter.points.forEach(check);
      chapter.scenes.forEach(scene => {
        scene.points.forEach(check);
      });
    });
  });
  alert("Point: " + foundText);
}

function addAct() {
  data.acts.push({ id: generateId(), text: 'New Act', collapsed: false, points: [], chapters: [] });
  saveData();
  render();
}

function addChapter(actId: string) {
  data.acts.forEach(act => {
    if (act.id === actId) {
      act.chapters.push({ id: generateId(), text: 'New Chapter', collapsed: false, points: [], scenes: [] });
    }
  });
  saveData();
  render();
}

function addScene(chapterId: string) {
  data.acts.forEach(act => {
    act.chapters.forEach(chapter => {
      if (chapter.id === chapterId) {
        chapter.scenes.push({ id: generateId(), text: 'New Scene', collapsed: false, points: [] });
      }
    });
  });
  saveData();
  render();
}

function deleteAct(actId: string) {
  data.acts = data.acts.filter(act => {
    if (act.id === actId) {
      if (act.points.length === 0 && act.chapters.length === 0) {
        return false;
      } else {
        alert("Cannot delete non-empty Act");
        return true;
      }
    }
    return true;
  });
  saveData();
  render();
}

function deleteChapter(chapterId: string) {
  data.acts.forEach(act => {
    act.chapters = act.chapters.filter(chapter => {
      if (chapter.id === chapterId) {
        if (chapter.points.length === 0 && chapter.scenes.length === 0) {
          return false;
        } else {
          alert("Cannot delete non-empty Chapter");
          return true;
        }
      }
      return true;
    });
  });
  saveData();
  render();
}

function deleteScene(sceneId: string) {
  data.acts.forEach(act => {
    act.chapters.forEach(chapter => {
      chapter.scenes = chapter.scenes.filter(scene => {
        if (scene.id === sceneId) {
          if (scene.points.length === 0) {
            return false;
          } else {
            alert("Cannot delete non-empty Scene");
            return true;
          }
        }
        return true;
      });
    });
  });
  saveData();
  render();
}

function deletePoint(pointId: string) {
  // Remove the point from any points array
  data.acts.forEach(act => {
    act.points = act.points.filter(p => p.id !== pointId);
    act.chapters.forEach(chapter => {
      chapter.points = chapter.points.filter(p => p.id !== pointId);
      chapter.scenes.forEach(scene => {
        scene.points = scene.points.filter(p => p.id !== pointId);
      });
    });
  });
  // Remove links to the deleted point from all other points
  data.acts.forEach(act => {
    act.points.forEach(p => p.links = p.links.filter(l => l !== pointId));
    act.chapters.forEach(chapter => {
      chapter.points.forEach(p => p.links = p.links.filter(l => l !== pointId));
      chapter.scenes.forEach(scene => {
        scene.points.forEach(p => p.links = p.links.filter(l => l !== pointId));
      });
    });
  });
  saveData();
  render();
}

function downloadCSV() {
  let csv = "Level,ID,Text,Links\n";
  data.acts.forEach(act => {
    csv += `Act,${act.id},"${act.text}",""\n`;
    act.points.forEach(point => {
      csv += `ActPoint,${point.id},"${point.text}","${point.links.join(";")}"\n`;
    });
    act.chapters.forEach(chapter => {
      csv += `Chapter,${chapter.id},"${chapter.text}",""\n`;
      chapter.points.forEach(point => {
        csv += `ChapterPoint,${point.id},"${point.text}","${point.links.join(";")}"\n`;
      });
      chapter.scenes.forEach(scene => {
        csv += `Scene,${scene.id},"${scene.text}",""\n`;
        scene.points.forEach(point => {
          csv += `ScenePoint,${point.id},"${point.text}","${point.links.join(";")}"\n`;
        });
      });
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notes.csv';
  a.click();
}

function collapseAll() {
  data.acts.forEach(act => {
    act.collapsed = true;
    act.points.forEach(point => point.collapsed = true);
    act.chapters.forEach(chapter => {
      chapter.collapsed = true;
      chapter.points.forEach(point => point.collapsed = true);
      chapter.scenes.forEach(scene => {
        scene.collapsed = true;
        scene.points.forEach(point => point.collapsed = true);
      });
    });
  });
  saveData();
  render();
}

render();

// Expose functions globally for simplicity
(window as any).addAct = addAct;
(window as any).updateText = updateText;
(window as any).updatePointText = updatePointText;
(window as any).highlightPoint = highlightPoint;
(window as any).addChapter = addChapter;
(window as any).addScene = addScene;
(window as any).deleteAct = deleteAct;
(window as any).deleteChapter = deleteChapter;
(window as any).deleteScene = deleteScene;
(window as any).deletePoint = deletePoint;
(window as any).toggleCollapse = toggleCollapse;
(window as any).collapseAll = collapseAll;
